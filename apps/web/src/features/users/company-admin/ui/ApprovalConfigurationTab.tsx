import type { PermissionCatalogEntry } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { UserRole } from '@forethread/shared-types/client';
import { Alert, Button, Input, Spinner, notificationService } from '@forethread/ui-components';
import { useMemo, useState, type ReactNode } from 'react';

import {
  useCustomRoleDetail,
  usePermissionCatalog,
  useRoleDetail,
  useUpdateCustomRole,
  useUpdateRolePermissions,
} from '@/features/roles/services/roles.service';

import { RoleConfigList, RoleEditorHeader } from './RoleConfigList';

/** Empty input = unlimited (null in DTO). Otherwise must parse as a finite number ≥ 0. */
function parseThresholdInput(value: string): number | null | 'invalid' {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return 'invalid';
  return parsed;
}

type Selection = { kind: 'builtin'; role: UserRole } | { kind: 'custom'; id: string };

/**
 * "Approval configuration" tab — set the spend limit at which a granted,
 * threshold-aware permission (e.g. `po.approve`) escalates to a higher-tier
 * approver. Covers both built-in roles and the company's custom roles
 * (FOR-286 — a custom role assigned to a user is that user's personal limit).
 * Grants themselves are managed in the "Role permissions" tab; this tab only
 * edits thresholds and leaves the permission set untouched on save.
 */
export default function ApprovalConfigurationTab() {
  const { t } = useTranslation('roles');
  const [selected, setSelected] = useState<Selection | null>(null);

  return (
    <div className="flex flex-1 flex-col gap-4 rounded-[18px] border border-gray-100 bg-[#F9F9FA] p-3 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
      {selected === null ? (
        <RoleConfigList
          onSelect={(role) => setSelected({ kind: 'builtin', role })}
          renderSubtitle={() => t('approval.listSubtitle')}
          onSelectCustom={(role) => setSelected({ kind: 'custom', id: role.id })}
          renderCustomSubtitle={() => t('approval.listSubtitle')}
        />
      ) : selected.kind === 'builtin' ? (
        <BuiltinApprovalEditor
          key={selected.role}
          role={selected.role}
          onBack={() => setSelected(null)}
        />
      ) : (
        <CustomApprovalEditor key={selected.id} id={selected.id} onBack={() => setSelected(null)} />
      )}
    </div>
  );
}

function BuiltinApprovalEditor({ role, onBack }: { role: UserRole; onBack: () => void }) {
  const { t } = useTranslation('roles');
  const detailQuery = useRoleDetail(role);
  const catalogQuery = usePermissionCatalog();
  const updateMutation = useUpdateRolePermissions(role);
  const isSuperAdmin = role === UserRole.SUPER_ADMIN;

  if (detailQuery.isLoading || catalogQuery.isLoading) {
    return <EditorSpinner />;
  }
  if (detailQuery.isError || catalogQuery.isError || !detailQuery.data || !catalogQuery.data) {
    return <Alert variant="destructive">{t('saveError')}</Alert>;
  }

  const detail = detailQuery.data;
  return (
    <ThresholdEditorForm
      header={<RoleEditorHeader role={role} onBack={onBack} />}
      locked={isSuperAdmin}
      lockedNotice={isSuperAdmin ? t('superAdminLocked') : undefined}
      permissionKeys={detail.permissionKeys}
      initialThresholds={detail.thresholds}
      catalog={catalogQuery.data}
      emptyMessage={t('approval.empty')}
      saving={updateMutation.isPending}
      onSave={async (thresholds) => {
        // Send the role's existing permission set unchanged — this tab only edits
        // thresholds, and the backend treats the body as the full desired grant.
        await updateMutation.mutateAsync({
          permissionKeys: [...detail.permissionKeys],
          thresholds,
        });
      }}
      onBack={onBack}
    />
  );
}

function CustomApprovalEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const { t } = useTranslation('roles');
  const detailQuery = useCustomRoleDetail(id);
  const catalogQuery = usePermissionCatalog();
  const updateMutation = useUpdateCustomRole(id);

  if (detailQuery.isLoading || catalogQuery.isLoading) {
    return <EditorSpinner />;
  }
  if (detailQuery.isError || catalogQuery.isError || !detailQuery.data || !catalogQuery.data) {
    return <Alert variant="destructive">{t('custom.loadError')}</Alert>;
  }

  return (
    <ThresholdEditorForm
      header={<RoleEditorHeader title={detailQuery.data.name} onBack={onBack} />}
      locked={false}
      permissionKeys={detailQuery.data.permissionKeys}
      initialThresholds={detailQuery.data.thresholds}
      catalog={catalogQuery.data}
      emptyMessage={t('approval.customEmpty')}
      saving={updateMutation.isPending}
      // Omitting permissionKeys keeps the custom role's grant set untouched —
      // the backend re-applies the existing keys with the new thresholds.
      onSave={async (thresholds) => {
        await updateMutation.mutateAsync({ thresholds });
      }}
      onBack={onBack}
    />
  );
}

function EditorSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Spinner size="md" />
    </div>
  );
}

interface ThresholdEditorFormProps {
  header: ReactNode;
  locked: boolean;
  lockedNotice?: string;
  permissionKeys: string[];
  initialThresholds: Record<string, number>;
  catalog: PermissionCatalogEntry[];
  emptyMessage: string;
  saving: boolean;
  onSave: (thresholds: Record<string, number | null>) => Promise<void>;
  onBack: () => void;
}

/**
 * The threshold inputs + save flow shared by the built-in-role and custom-role
 * approval editors. Mounted only once its data props are loaded, so input state
 * initialises straight from props.
 */
function ThresholdEditorForm({
  header,
  locked,
  lockedNotice,
  permissionKeys,
  initialThresholds,
  catalog,
  emptyMessage,
  saving,
  onSave,
  onBack,
}: ThresholdEditorFormProps) {
  const { t } = useTranslation('roles');
  const [thresholdInputs, setThresholdInputs] = useState<Record<string, string>>(() => {
    const inputs: Record<string, string> = {};
    for (const [key, value] of Object.entries(initialThresholds)) {
      inputs[key] = String(value);
    }
    return inputs;
  });

  // The threshold-aware permissions that are actually granted to this role —
  // only these can carry a cap (the backend rejects thresholds on un-granted keys).
  const approvalEntries = useMemo(() => {
    const granted = new Set(permissionKeys);
    return catalog
      .filter((entry) => entry.thresholdAware && granted.has(entry.key))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [permissionKeys, catalog]);

  const isDirty = approvalEntries.some((entry) => {
    const parsed = parseThresholdInput(thresholdInputs[entry.key] ?? '');
    if (parsed === 'invalid') return true;
    const previous = initialThresholds[entry.key] ?? null;
    return parsed !== previous;
  });

  const setThresholdInput = (key: string, value: string) => {
    if (locked) return;
    setThresholdInputs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!isDirty) {
      notificationService.info(t('noChanges'));
      return;
    }

    const thresholds: Record<string, number | null> = {};
    for (const entry of approvalEntries) {
      const parsed = parseThresholdInput(thresholdInputs[entry.key] ?? '');
      if (parsed === 'invalid') {
        notificationService.error(t('invalidThreshold'));
        return;
      }
      thresholds[entry.key] = parsed;
    }

    try {
      await onSave(thresholds);
      notificationService.success(t('saved'));
      onBack();
    } catch {
      notificationService.error(t('saveError'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {header}

      {lockedNotice && <Alert variant="info">{lockedNotice}</Alert>}

      {approvalEntries.length === 0 ? (
        <div className="rounded-[12px] border border-gray-100 bg-white p-8 text-center text-sm text-gray-500 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
          {emptyMessage}
        </div>
      ) : (
        <>
          <section className="rounded-[12px] border border-gray-100 bg-white p-5 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
            <p className="mb-4 text-xs text-gray-500">{t('approval.editorHint')}</p>
            <ul className="flex flex-col gap-4">
              {approvalEntries.map((entry) => (
                <li
                  key={entry.key}
                  className="border-b border-gray-50 pb-4 last:border-0 last:pb-0"
                >
                  <p className="text-sm font-medium text-gray-900">{entry.description}</p>
                  <p className="font-mono text-xs text-gray-500">{entry.key}</p>
                  <div className="mt-2 w-40">
                    <label
                      htmlFor={`threshold-${entry.key}`}
                      className="mb-1 block text-xs font-medium text-gray-900"
                    >
                      {t('thresholdLabel')}
                    </label>
                    <Input
                      id={`threshold-${entry.key}`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      inputSize="sm"
                      value={thresholdInputs[entry.key] ?? ''}
                      placeholder={t('thresholdPlaceholder')}
                      onChange={(e) => setThresholdInput(entry.key, e.target.value)}
                      disabled={locked}
                      data-testid={`threshold-${entry.key}`}
                    />
                    <p className="mt-1 text-xs text-gray-500">{t('thresholdHint')}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onBack}>
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSave()}
              disabled={!isDirty || saving || locked}
            >
              {saving ? t('saving') : t('save')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
