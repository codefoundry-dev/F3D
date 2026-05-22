import { useTranslation } from '@forethread/i18n';
import { UserRole } from '@forethread/shared-types/client';
import { Alert, Button, Checkbox, Spinner, notificationService } from '@forethread/ui-components';
import ArrowRightIcon from '@forethread/ui-components/assets/icons/arrow-right.svg?react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

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
  const isDirty =
    selected.size !== original.size ||
    [...selected].some((k) => !original.has(k));
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

  const handleSave = async () => {
    if (!isDirty) {
      notificationService.info(t('noChanges'));
      return;
    }
    try {
      await updateMutation.mutateAsync({ permissionKeys: [...selected] });
      notificationService.success(t('saved'));
      navigate(ROUTES.roles);
    } catch {
      notificationService.error(t('saveError'));
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <button
        type="button"
        onClick={() => navigate(ROUTES.roles)}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowRightIcon className="w-4 h-4 rotate-180" />
        {t('back')}
      </button>

      <h1 className="text-xl font-semibold text-foreground">{t(`roleNames.${role}`)}</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">{t('subtitle')}</p>

      {isSuperAdmin && (
        <Alert variant="info" className="mb-6">
          {t('superAdminLocked')}
        </Alert>
      )}

      <div className="space-y-6">
        {grouped.map((group) => (
          <section
            key={group.domain}
            className="rounded-xl border border-border bg-card p-5"
            data-testid={`group-${group.domain}`}
          >
            <h2 className="text-sm font-semibold text-foreground mb-3">
              {t(`domains.${group.domain}`)}
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              {group.entries.map((entry) => (
                <li key={entry.key}>
                  <Checkbox
                    checked={selected.has(entry.key)}
                    onChange={() => toggle(entry.key)}
                    disabled={isSuperAdmin}
                    label={entry.description}
                  />
                  <p className="text-xs text-muted-foreground ml-7 font-mono">{entry.key}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={() => navigate(ROUTES.roles)}>
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
