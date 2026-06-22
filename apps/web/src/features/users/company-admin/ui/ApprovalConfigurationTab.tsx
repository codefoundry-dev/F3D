import { useTranslation } from '@forethread/i18n';
import { UserRole } from '@forethread/shared-types/client';
import {
  Alert,
  Button,
  Input,
  Spinner,
  notificationService,
} from '@forethread/ui-components';
import { useEffect, useMemo, useState } from 'react';

import {
  usePermissionCatalog,
  useRoleDetail,
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

/**
 * "Approval configuration" tab — set the spend limit at which a granted,
 * threshold-aware permission (e.g. `po.approve`) escalates to a higher-tier
 * approver. Grants themselves are managed in the "Role permissions" tab; this
 * tab only edits thresholds and leaves the permission set untouched on save.
 */
export default function ApprovalConfigurationTab() {
  const { t } = useTranslation('roles');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  return (
    <div className="flex flex-1 flex-col gap-4 rounded-[18px] border border-gray-100 bg-[#F9F9FA] p-3 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
      {selectedRole ? (
        <ApprovalConfigEditor role={selectedRole} onBack={() => setSelectedRole(null)} />
      ) : (
        <RoleConfigList
          onSelect={setSelectedRole}
          renderSubtitle={() => t('approval.listSubtitle')}
        />
      )}
    </div>
  );
}

interface EditorProps {
  role: UserRole;
  onBack: () => void;
}

function ApprovalConfigEditor({ role, onBack }: EditorProps) {
  const { t } = useTranslation('roles');
  const detailQuery = useRoleDetail(role);
  const catalogQuery = usePermissionCatalog();
  const updateMutation = useUpdateRolePermissions(role);

  const [thresholdInputs, setThresholdInputs] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (detailQuery.data && !hydrated) {
      const inputs: Record<string, string> = {};
      for (const [key, value] of Object.entries(detailQuery.data.thresholds)) {
        inputs[key] = String(value);
      }
      setThresholdInputs(inputs);
      setHydrated(true);
    }
  }, [detailQuery.data, hydrated]);

  // The threshold-aware permissions that are actually granted to this role —
  // only these can carry a cap (the backend rejects thresholds on un-granted keys).
  const approvalEntries = useMemo(() => {
    if (!detailQuery.data || !catalogQuery.data) return [];
    const granted = new Set(detailQuery.data.permissionKeys);
    return catalogQuery.data
      .filter((entry) => entry.thresholdAware && granted.has(entry.key))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [detailQuery.data, catalogQuery.data]);

  const isSuperAdmin = role === UserRole.SUPER_ADMIN;

  if (detailQuery.isLoading || catalogQuery.isLoading || !hydrated) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="md" />
      </div>
    );
  }

  if (detailQuery.isError || catalogQuery.isError || !detailQuery.data || !catalogQuery.data) {
    return <Alert variant="destructive">{t('saveError')}</Alert>;
  }

  const originalThresholds = detailQuery.data.thresholds;
  const isDirty = approvalEntries.some((entry) => {
    const parsed = parseThresholdInput(thresholdInputs[entry.key] ?? '');
    if (parsed === 'invalid') return true;
    const previous = originalThresholds[entry.key] ?? null;
    return parsed !== previous;
  });

  const setThresholdInput = (key: string, value: string) => {
    if (isSuperAdmin) return;
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
      // Send the role's existing permission set unchanged — this tab only edits
      // thresholds, and the backend treats the body as the full desired grant.
      await updateMutation.mutateAsync({
        permissionKeys: [...detailQuery.data.permissionKeys],
        thresholds,
      });
      notificationService.success(t('saved'));
      onBack();
    } catch {
      notificationService.error(t('saveError'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <RoleEditorHeader role={role} onBack={onBack} />

      {isSuperAdmin && <Alert variant="info">{t('superAdminLocked')}</Alert>}

      {approvalEntries.length === 0 ? (
        <div className="rounded-[12px] border border-gray-100 bg-white p-8 text-center text-sm text-gray-500 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
          {t('approval.empty')}
        </div>
      ) : (
        <>
          <section className="rounded-[12px] border border-gray-100 bg-white p-5 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
            <p className="mb-4 text-xs text-gray-500">{t('approval.editorHint')}</p>
            <ul className="flex flex-col gap-4">
              {approvalEntries.map((entry) => (
                <li key={entry.key} className="border-b border-gray-50 pb-4 last:border-0 last:pb-0">
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
                      disabled={isSuperAdmin}
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
              disabled={!isDirty || updateMutation.isPending || isSuperAdmin}
            >
              {updateMutation.isPending ? t('saving') : t('save')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
