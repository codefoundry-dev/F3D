import { getAdminPanelState, type AdminPanelComponent } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { notificationService, type SortDirection } from '@forethread/ui-components';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { ComponentStatus } from '../../types/super-admin/platform-state.types';
import type { SortKey } from '../../types/super-admin/platform-state.types';

interface SortState {
  column: SortKey | null;
  direction: SortDirection;
}

export function usePlatformState() {
  const { t } = useTranslation('dashboard');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'admin-panel'],
    queryFn: () => getAdminPanelState(),
    staleTime: 30_000,
  });

  const [overrides, setOverrides] = useState<Record<string, { status?: string }>>({});
  const [reloadingIds, setReloadingIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortState>({ column: null, direction: null });

  const components = useMemo(() => {
    if (!data?.components) return [];
    return data.components.map((c) => ({
      ...c,
      status: (overrides[c.id]?.status ?? c.status) as AdminPanelComponent['status'],
    }));
  }, [data, overrides]);

  const handleSort = useCallback((key: SortKey) => {
    setSort((prev) => {
      if (prev.column !== key) return { column: key, direction: 'asc' };
      if (prev.direction === 'asc') return { column: key, direction: 'desc' };
      return { column: null, direction: null };
    });
  }, []);

  const sortedComponents = useMemo(() => {
    if (!sort.column || !sort.direction) return components;

    const col = sort.column;
    const dir = sort.direction === 'asc' ? 1 : -1;

    const fieldMap: Record<SortKey, (c: AdminPanelComponent) => string> = {
      component: (c) => c.name,
      status: (c) => c.status,
      lastSuccessfulRun: (c) => c.lastSuccessfulRun ?? '',
      lastError: (c) => c.lastError ?? '',
      errorInfo: (c) => c.errorInfo ?? '',
    };

    return [...components].sort((a, b) => fieldMap[col](a).localeCompare(fieldMap[col](b)) * dir);
  }, [components, sort]);

  const toggleIntegration = useCallback(
    (row: AdminPanelComponent) => {
      const isCurrentlyDisabled = (row.status as ComponentStatus) === ComponentStatus.DISABLED;
      const newStatus = isCurrentlyDisabled ? ComponentStatus.HEALTHY : ComponentStatus.DISABLED;

      setOverrides((prev) => ({ ...prev, [row.id]: { status: newStatus } }));

      notificationService.success(
        isCurrentlyDisabled
          ? t('platformState.integrationEnabled', { name: row.name })
          : t('platformState.integrationDisabled', { name: row.name }),
      );
    },
    [t],
  );

  const reloadComponent = useCallback(
    (row: AdminPanelComponent) => {
      setReloadingIds((prev) => new Set(prev).add(row.id));

      setTimeout(() => {
        setOverrides((prev) => ({ ...prev, [row.id]: { status: ComponentStatus.HEALTHY } }));
        setReloadingIds((prev) => {
          const next = new Set(prev);
          next.delete(row.id);
          return next;
        });
        notificationService.success(t('platformState.reloadSuccess', { name: row.name }));
      }, 1500);
    },
    [t],
  );

  const canToggle = (row: AdminPanelComponent) => row.category === 'integration';

  const canReload = (row: AdminPanelComponent) =>
    (row.status as ComponentStatus) === ComponentStatus.ERROR ||
    (row.status as ComponentStatus) === ComponentStatus.WARNING;

  const isReloading = (id: string) => reloadingIds.has(id);

  const isDisabled = (row: AdminPanelComponent) =>
    (row.status as ComponentStatus) === ComponentStatus.DISABLED;

  return {
    sortedComponents,
    sort,
    handleSort,
    toggleIntegration,
    reloadComponent,
    canToggle,
    canReload,
    isReloading,
    isDisabled,
    isLoading,
  };
}
