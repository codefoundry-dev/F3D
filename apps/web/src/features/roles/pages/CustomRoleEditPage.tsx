import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import {
  Alert,
  Button,
  GridModal,
  Input,
  Spinner,
  notificationService,
} from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import ShieldIcon from '@forethread/ui-components/assets/icons/shield-icon.svg?react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { usePermissions } from '@/shared/role';

import { PermissionGrid, parseThresholdInput } from '../components/PermissionGrid';
import { groupCatalogByDomain } from '../hooks/usePermissionGroups';
import {
  useCustomRoleDetail,
  useDeleteCustomRole,
  usePermissionCatalog,
  useUpdateCustomRole,
} from '../services/roles.service';

/**
 * Editor for an admin-defined custom role (FOR-252): name, description and the
 * granted permission set (with approval thresholds). Mirrors the built-in
 * RoleEditPage; deletion is gated on `role.delete`.
 */
export default function CustomRoleEditPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <Navigate to={ROUTES.roles} replace />;
  }

  return <CustomRoleEditor id={id} />;
}

function CustomRoleEditor({ id }: { id: string }) {
  const { t } = useTranslation('roles');
  const navigate = useNavigate();
  const { has } = usePermissions();
  const detailQuery = useCustomRoleDetail(id);
  const catalogQuery = usePermissionCatalog();
  const updateMutation = useUpdateCustomRole(id);
  const deleteMutation = useDeleteCustomRole();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [thresholdInputs, setThresholdInputs] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Surface the role name in the app-bar breadcrumb (Roles › {name}).
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  const roleName = detailQuery.data?.name;
  useEffect(() => {
    if (!roleName) return;
    setPageTitle(roleName, null, ROUTES.roles, [
      { label: t('title'), to: ROUTES.roles },
      { label: roleName },
    ]);
    return () => setPageTitle(null);
  }, [setPageTitle, t, roleName]);

  useEffect(() => {
    if (detailQuery.data && !hydrated) {
      setName(detailQuery.data.name);
      setDescription(detailQuery.data.description ?? '');
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

  // Error state first — hydration never completes for a failed load, so the
  // spinner branch would otherwise show forever.
  if (detailQuery.isError || catalogQuery.isError) {
    return (
      <div className="p-8">
        <Alert variant="destructive">{t('custom.notFound')}</Alert>
      </div>
    );
  }

  if (detailQuery.isLoading || catalogQuery.isLoading || !hydrated) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="md" />
      </div>
    );
  }

  if (!detailQuery.data || !catalogQuery.data) {
    return (
      <div className="p-8">
        <Alert variant="destructive">{t('custom.notFound')}</Alert>
      </div>
    );
  }

  const original = new Set(detailQuery.data.permissionKeys);
  const originalThresholds = detailQuery.data.thresholds;
  const nameDirty =
    name.trim() !== detailQuery.data.name ||
    description.trim() !== (detailQuery.data.description ?? '');
  const permissionsDirty =
    selected.size !== original.size || [...selected].some((k) => !original.has(k));
  const thresholdsDirty = (() => {
    const grantedThresholdKeys = [...selected].filter((k) => thresholdAwareByKey.get(k));
    const seen = new Set<string>();
    for (const key of grantedThresholdKeys) {
      seen.add(key);
      const parsed = parseThresholdInput(thresholdInputs[key] ?? '');
      if (parsed === 'invalid') return true;
      const previous = originalThresholds[key] ?? null;
      if (parsed !== previous) return true;
    }
    return Object.keys(originalThresholds).some((k) => !seen.has(k));
  })();
  const isDirty = nameDirty || permissionsDirty || thresholdsDirty;

  const toggle = (key: string) => {
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
    if (!name.trim()) {
      notificationService.error(t('custom.nameRequired'));
      return;
    }

    const thresholds: Record<string, number | null> = {};
    for (const key of selected) {
      if (!thresholdAwareByKey.get(key)) continue;
      const parsed = parseThresholdInput(thresholdInputs[key] ?? '');
      if (parsed === 'invalid') {
        notificationService.error(t('invalidThreshold'));
        return;
      }
      thresholds[key] = parsed;
    }

    try {
      await updateMutation.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        permissionKeys: [...selected],
        thresholds,
      });
      notificationService.success(t('saved'));
      navigate(ROUTES.roles);
    } catch {
      notificationService.error(t('saveError'));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id);
      notificationService.success(t('custom.deleted'));
      navigate(ROUTES.roles);
    } catch {
      notificationService.error(t('custom.deleteError'));
      setConfirmingDelete(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 px-6 py-4">
      {/* ── Page header ── */}
      <div className="flex items-center gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white p-px text-gray-700 shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]">
          <ShieldIcon className="size-[15px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-medium leading-[1.4] tracking-[0.3px] text-gray-900">
            {detailQuery.data.name}
          </h1>
          <p className="text-sm leading-tight text-gray-500">{t('custom.editSubtitle')}</p>
        </div>
        {has('role.delete') && (
          <Button
            variant="destructive"
            onClick={() => setConfirmingDelete(true)}
            data-testid="custom-role-delete"
          >
            {t('custom.delete')}
          </Button>
        )}
      </div>

      {/* ── Name & description ── */}
      <section className="rounded-[12px] border border-gray-100 bg-white p-5 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="custom-role-name"
              className="mb-1 block text-xs font-medium text-gray-900"
            >
              {t('custom.nameLabel')}
            </label>
            <Input
              id="custom-role-name"
              value={name}
              placeholder={t('custom.namePlaceholder')}
              onChange={(e) => setName(e.target.value)}
              data-testid="custom-role-name"
            />
          </div>
          <div>
            <label
              htmlFor="custom-role-description"
              className="mb-1 block text-xs font-medium text-gray-900"
            >
              {t('custom.descriptionLabel')}
            </label>
            <Input
              id="custom-role-description"
              value={description}
              placeholder={t('custom.descriptionPlaceholder')}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="custom-role-description"
            />
          </div>
        </div>
      </section>

      <PermissionGrid
        grouped={grouped}
        selected={selected}
        onToggle={toggle}
        thresholdInputs={thresholdInputs}
        onThresholdChange={(key, value) =>
          setThresholdInputs((prev) => ({ ...prev, [key]: value }))
        }
      />

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={() => navigate(ROUTES.roles)}>
          {t('cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={() => void handleSave()}
          disabled={!isDirty || updateMutation.isPending}
        >
          {updateMutation.isPending ? t('saving') : t('save')}
        </Button>
      </div>

      {confirmingDelete && (
        <GridModal
          onClose={() => setConfirmingDelete(false)}
          icon={<CrossInCircleIcon className="size-6 text-destructive" />}
          title={t('custom.deleteTitle')}
          description={t('custom.deleteDescription', { name: detailQuery.data.name })}
          actions={
            <>
              <Button
                variant="destructive"
                size="lg"
                onClick={() => void handleDelete()}
                isLoading={deleteMutation.isPending}
                className="w-full"
                data-testid="custom-role-delete-confirm"
              >
                {t('custom.deleteConfirm')}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleteMutation.isPending}
                className="w-full"
              >
                {t('cancel')}
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}
