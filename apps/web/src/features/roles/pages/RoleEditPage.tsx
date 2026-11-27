import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { UserRole } from '@forethread/shared-types/client';
import { Alert, Button, Spinner, notificationService } from '@forethread/ui-components';
import ShieldIcon from '@forethread/ui-components/assets/icons/shield-icon.svg?react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useSettingsCrumb } from '@/shared/layout/useSettingsCrumb';

import { PermissionGrid, parseThresholdInput } from '../components/PermissionGrid';
import { groupCatalogByDomain } from '../hooks/usePermissionGroups';
import {
  usePermissionCatalog,
  useRoleDetail,
  useUpdateRolePermissions,
} from '../services/roles.service';

function isUserRole(value: string): value is UserRole {
  return (Object.values(UserRole) as string[]).includes(value);
}

export default function RoleEditPage() {
  const { role } = useParams<{ role: string }>();

  if (!role || !isUserRole(role)) {
    return <Navigate to={ROUTES.roles} replace />;
  }

  return <RoleEditor role={role} />;
}

interface RoleEditorProps {
  role: UserRole;
}

function RoleEditor({ role }: RoleEditorProps) {
  const { t } = useTranslation('roles');
  const navigate = useNavigate();
  const detailQuery = useRoleDetail(role);
  const catalogQuery = usePermissionCatalog();
  const updateMutation = useUpdateRolePermissions(role);

  // Surface the role name in the app-bar breadcrumb (Settings › Roles › {role}).
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  const settingsCrumb = useSettingsCrumb();
  useEffect(() => {
    setPageTitle(t(`roleNames.${role}`), null, ROUTES.roles, [
      settingsCrumb,
      { label: t('title'), to: ROUTES.roles },
      { label: t(`roleNames.${role}`) },
    ]);
    return () => setPageTitle(null);
  }, [setPageTitle, t, role, settingsCrumb]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [thresholdInputs, setThresholdInputs] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (detailQuery.data && !hydrated) {
      setSelected(new Set(detailQuery.data.permissionKeys));
      const inputs: Record<string, string> = {};
      for (const [key, value] of Object.entries(detailQuery.data.thresholds)) {
        inputs[key] = String(value);
      }
      setThresholdInputs(inputs);
      setHydrated(true);
    }
  }, [detailQuery.data, hydrated]);

  const grouped = useMemo(
    () => (catalogQuery.data ? groupCatalogByDomain(catalogQuery.data) : []),
    [catalogQuery.data],
  );

  const thresholdAwareByKey = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const entry of catalogQuery.data ?? []) {
      map.set(entry.key, entry.thresholdAware);
    }
    return map;
  }, [catalogQuery.data]);

  if (detailQuery.isLoading || catalogQuery.isLoading || !hydrated) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="md" />
      </div>
    );
  }

  if (detailQuery.isError || catalogQuery.isError || !detailQuery.data || !catalogQuery.data) {
    return (
      <div className="p-8">
        <Alert variant="destructive">{t('saveError')}</Alert>
      </div>
    );
  }

  const original = new Set(detailQuery.data.permissionKeys);
  const originalThresholds = detailQuery.data.thresholds;
  const permissionsDirty =
    selected.size !== original.size || [...selected].some((k) => !original.has(k));
  const thresholdsDirty = (() => {
    const grantedThresholdKeys = [...selected].filter((k) => thresholdAwareByKey.get(k));
    const seen = new Set<string>();
    for (const key of grantedThresholdKeys) {
      seen.add(key);
      const input = thresholdInputs[key] ?? '';
      const parsed = parseThresholdInput(input);
      // Invalid input is a pending change — surface validation on Save instead
      // of silently letting the user re-press a no-op button.
      if (parsed === 'invalid') return true;
      const previous = originalThresholds[key] ?? null;
      if (parsed !== previous) return true;
    }
    // A previously-set threshold for a now-revoked permission is implicitly cleared
    return Object.keys(originalThresholds).some((k) => !seen.has(k));
  })();
  const isDirty = permissionsDirty || thresholdsDirty;
  const isSuperAdmin = role === UserRole.SUPER_ADMIN;

  const toggle = (key: string) => {
    if (isSuperAdmin) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const setThresholdInput = (key: string, value: string) => {
    if (isSuperAdmin) return;
    setThresholdInputs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!isDirty) {
      notificationService.info(t('noChanges'));
      return;
    }

    // Validate threshold inputs before submit
    const thresholds: Record<string, number | null> = {};
    for (const key of selected) {
      if (!thresholdAwareByKey.get(key)) continue;
      const parsed = parseThresholdInput(thresholdInputs[key] ?? '');
      if (parsed === 'invalid') {
        notificationService.error(t('invalidThreshold'));
        return;
      }
      if (parsed !== null) {
        thresholds[key] = parsed;
      } else {
        thresholds[key] = null;
      }
    }

    try {
      await updateMutation.mutateAsync({ permissionKeys: [...selected], thresholds });
      notificationService.success(t('saved'));
      void navigate(ROUTES.roles);
    } catch {
      notificationService.error(t('saveError'));
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 px-6 py-4">
      {/* ── Page header ── */}
      <div className="flex items-center gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white p-px text-gray-700 shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]">
          <ShieldIcon className="size-[15px]" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[20px] font-medium leading-[1.4] tracking-[0.3px] text-gray-900">
            {t(`roleNames.${role}`)}
          </h1>
          <p className="text-sm leading-tight text-gray-500">{t('subtitle')}</p>
        </div>
      </div>

      {isSuperAdmin && <Alert variant="info">{t('superAdminLocked')}</Alert>}

      <PermissionGrid
        grouped={grouped}
        selected={selected}
        onToggle={toggle}
        thresholdInputs={thresholdInputs}
        onThresholdChange={setThresholdInput}
        disabled={isSuperAdmin}
      />

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={() => void navigate(ROUTES.roles)}>
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
