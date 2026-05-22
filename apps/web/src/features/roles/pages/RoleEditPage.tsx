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

/** Empty input = unlimited (null in DTO). Otherwise must parse as a finite number ≥ 0. */
function parseThresholdInput(value: string): number | null | 'invalid' {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return 'invalid';
  return parsed;
}

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
              {group.entries.map((entry) => {
                const isChecked = selected.has(entry.key);
                const showThreshold = entry.thresholdAware && isChecked;
                return (
                  <li key={entry.key}>
                    <Checkbox
                      checked={isChecked}
                      onChange={() => toggle(entry.key)}
                      disabled={isSuperAdmin}
                      label={entry.description}
                    />
                    <p className="text-xs text-muted-foreground ml-7 font-mono">{entry.key}</p>
                    {showThreshold && (
                      <div className="ml-7 mt-2">
                        <label
                          htmlFor={`threshold-${entry.key}`}
                          className="block text-xs font-medium text-foreground mb-1"
                        >
                          {t('thresholdLabel')}
                        </label>
                        <input
                          id={`threshold-${entry.key}`}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="any"
                          value={thresholdInputs[entry.key] ?? ''}
                          placeholder={t('thresholdPlaceholder')}
                          onChange={(e) => setThresholdInput(entry.key, e.target.value)}
                          disabled={isSuperAdmin}
                          data-testid={`threshold-${entry.key}`}
                          className="w-40 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('thresholdHint')}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
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
