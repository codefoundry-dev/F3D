import type { PermissionCatalogEntry } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { UserRole } from '@forethread/shared-types/client';
import { Alert, Button, Checkbox, Spinner, notificationService } from '@forethread/ui-components';
import { useMemo, useState, type ReactNode } from 'react';

import { CreateCustomRoleModal } from '@/features/roles/components/CreateCustomRoleModal';
import { groupCatalogByDomain } from '@/features/roles/hooks/usePermissionGroups';
import {
  useCustomRoleDetail,
  usePermissionCatalog,
  useRoleDetail,
  useUpdateCustomRole,
  useUpdateRolePermissions,
} from '@/features/roles/services/roles.service';
import { usePermissions } from '@/shared/role';

import { RoleConfigList, RoleEditorHeader } from './RoleConfigList';

type Selection = { kind: 'builtin'; role: UserRole } | { kind: 'custom'; id: string };

/**
 * "Role permissions" tab — grant or revoke permissions per role, covering both
 * built-in roles and the company's custom roles (FOR-252/FOR-286; custom roles
 * can also be created from here so a Company Admin never needs the standalone
 * Super-Admin roles page). The approval-threshold side of the old combined
 * editor lives in the adjacent "Approval configuration" tab; this tab preserves
 * whatever thresholds are already set when it saves.
 */
export default function RolePermissionsTab() {
  const { t } = useTranslation('roles');
  const { has } = usePermissions();
  const [selected, setSelected] = useState<Selection | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-1 flex-col gap-4 rounded-[18px] border border-gray-100 bg-[#F9F9FA] p-3 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
      {selected === null ? (
        <>
          <RoleConfigList
            onSelect={(role) => setSelected({ kind: 'builtin', role })}
            renderSubtitle={(_role, count) => t('permissionCount', { count })}
            onSelectCustom={(role) => setSelected({ kind: 'custom', id: role.id })}
            renderCustomSubtitle={(role) => t('permissionCount', { count: role.permissionCount })}
            customHeadingSlot={
              has('role.create') ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreating(true)}
                  data-testid="tab-create-custom-role"
                >
                  {t('custom.create')}
                </Button>
              ) : undefined
            }
          />
          {creating && (
            <CreateCustomRoleModal
              onClose={() => setCreating(false)}
              onCreated={(id) => {
                setCreating(false);
                setSelected({ kind: 'custom', id });
              }}
            />
          )}
        </>
      ) : selected.kind === 'builtin' ? (
        <BuiltinPermissionsEditor
          key={selected.role}
          role={selected.role}
          onBack={() => setSelected(null)}
        />
      ) : (
        <CustomPermissionsEditor
          key={selected.id}
          id={selected.id}
          onBack={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function BuiltinPermissionsEditor({ role, onBack }: { role: UserRole; onBack: () => void }) {
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

  return (
    <PermissionsEditorForm
      header={<RoleEditorHeader role={role} onBack={onBack} />}
      locked={isSuperAdmin}
      lockedNotice={isSuperAdmin ? t('superAdminLocked') : undefined}
      initialPermissionKeys={detailQuery.data.permissionKeys}
      currentThresholds={detailQuery.data.thresholds}
      catalog={catalogQuery.data}
      saving={updateMutation.isPending}
      onSave={async (permissionKeys, thresholds) => {
        await updateMutation.mutateAsync({ permissionKeys, thresholds });
      }}
      onBack={onBack}
    />
  );
}

function CustomPermissionsEditor({ id, onBack }: { id: string; onBack: () => void }) {
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
    <PermissionsEditorForm
      header={<RoleEditorHeader title={detailQuery.data.name} onBack={onBack} />}
      locked={false}
      initialPermissionKeys={detailQuery.data.permissionKeys}
      currentThresholds={detailQuery.data.thresholds}
      catalog={catalogQuery.data}
      saving={updateMutation.isPending}
      onSave={async (permissionKeys, thresholds) => {
        await updateMutation.mutateAsync({ permissionKeys, thresholds });
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

interface PermissionsEditorFormProps {
  header: ReactNode;
  locked: boolean;
  lockedNotice?: string;
  initialPermissionKeys: string[];
  /** Thresholds already configured — preserved for keys that stay granted. */
  currentThresholds: Record<string, number>;
  catalog: PermissionCatalogEntry[];
  saving: boolean;
  onSave: (permissionKeys: string[], thresholds: Record<string, number | null>) => Promise<void>;
  onBack: () => void;
}

/**
 * The grouped permission checkboxes + save flow shared by the built-in-role and
 * custom-role editors. Mounted only once its data props are loaded, so checkbox
 * state initialises straight from props.
 */
function PermissionsEditorForm({
  header,
  locked,
  lockedNotice,
  initialPermissionKeys,
  currentThresholds,
  catalog,
  saving,
  onSave,
  onBack,
}: PermissionsEditorFormProps) {
  const { t } = useTranslation('roles');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialPermissionKeys));

  const grouped = useMemo(() => groupCatalogByDomain(catalog), [catalog]);

  const original = new Set(initialPermissionKeys);
  const isDirty = selected.size !== original.size || [...selected].some((k) => !original.has(k));

  const toggle = (key: string) => {
    if (locked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    if (!isDirty) {
      notificationService.info(t('noChanges'));
      return;
    }

    // Preserve any approval thresholds the sibling tab has set for permissions
    // that remain granted (the backend clears thresholds it isn't told about).
    const thresholds: Record<string, number | null> = {};
    for (const [key, value] of Object.entries(currentThresholds)) {
      if (selected.has(key)) thresholds[key] = value;
    }

    try {
      await onSave([...selected], thresholds);
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

      <div className="space-y-4">
        {grouped.map((group) => (
          <section
            key={group.domain}
            className="rounded-[12px] border border-gray-100 bg-white p-5 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]"
            data-testid={`group-${group.domain}`}
          >
            <h2 className="mb-3 text-sm font-semibold text-gray-900">
              {t(`domains.${group.domain}`)}
            </h2>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
              {group.entries.map((entry) => (
                <li key={entry.key}>
                  <Checkbox
                    checked={selected.has(entry.key)}
                    onChange={() => toggle(entry.key)}
                    disabled={locked}
                    label={entry.description}
                  />
                  <p className="ml-7 font-mono text-xs text-gray-500">{entry.key}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

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
    </div>
  );
}
