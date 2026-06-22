import { useTranslation } from '@forethread/i18n';
import { UserRole } from '@forethread/shared-types/client';
import { Alert, Button, Checkbox, Spinner, notificationService } from '@forethread/ui-components';
import { useEffect, useMemo, useState } from 'react';

import { groupCatalogByDomain } from '@/features/roles/hooks/usePermissionGroups';
import {
  usePermissionCatalog,
  useRoleDetail,
  useUpdateRolePermissions,
} from '@/features/roles/services/roles.service';

import { RoleConfigList, RoleEditorHeader } from './RoleConfigList';

/**
 * "Role permissions" tab — grant or revoke permissions per built-in role.
 * The approval-threshold side of the old combined editor now lives in the
 * adjacent "Approval configuration" tab; this tab preserves whatever thresholds
 * are already set when it saves.
 */
export default function RolePermissionsTab() {
  const { t } = useTranslation('roles');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  return (
    <div className="flex flex-1 flex-col gap-4 rounded-[18px] border border-gray-100 bg-[#F9F9FA] p-3 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
      {selectedRole ? (
        <RolePermissionsEditor role={selectedRole} onBack={() => setSelectedRole(null)} />
      ) : (
        <RoleConfigList
          onSelect={setSelectedRole}
          renderSubtitle={(_role, count) => t('permissionCount', { count })}
        />
      )}
    </div>
  );
}

interface EditorProps {
  role: UserRole;
  onBack: () => void;
}

function RolePermissionsEditor({ role, onBack }: EditorProps) {
  const { t } = useTranslation('roles');
  const detailQuery = useRoleDetail(role);
  const catalogQuery = usePermissionCatalog();
  const updateMutation = useUpdateRolePermissions(role);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (detailQuery.data && !hydrated) {
      setSelected(new Set(detailQuery.data.permissionKeys));
      setHydrated(true);
    }
  }, [detailQuery.data, hydrated]);

  const grouped = useMemo(
    () => (catalogQuery.data ? groupCatalogByDomain(catalogQuery.data) : []),
    [catalogQuery.data],
  );

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

  const original = new Set(detailQuery.data.permissionKeys);
  const isDirty =
    selected.size !== original.size || [...selected].some((k) => !original.has(k));

  const toggle = (key: string) => {
    if (isSuperAdmin) return;
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
    for (const [key, value] of Object.entries(detailQuery.data.thresholds)) {
      if (selected.has(key)) thresholds[key] = value;
    }

    try {
      await updateMutation.mutateAsync({ permissionKeys: [...selected], thresholds });
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
                    disabled={isSuperAdmin}
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
          disabled={!isDirty || updateMutation.isPending || isSuperAdmin}
        >
          {updateMutation.isPending ? t('saving') : t('save')}
        </Button>
      </div>
    </div>
  );
}
