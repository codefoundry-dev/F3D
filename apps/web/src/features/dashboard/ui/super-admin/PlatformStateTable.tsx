import { useTranslation } from '@forethread/i18n';
import { Badge, Spinner, SortIcon, ToggleSwitch } from '@forethread/ui-components';
import CircleReloadIcon from '@forethread/ui-components/assets/icons/circle-reload.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { STATUS_COLORS } from '../../constants/super-admin/dashboard.constants';
import { usePlatformState } from '../../hooks/super-admin/usePlatformState';
import type { SortKey } from '../../types/super-admin/platform-state.types';

export function PlatformStateTable() {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const {
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
  } = usePlatformState();

  const headers: { key: string; sortKey?: SortKey; label: string; sortable: boolean }[] = [
    { key: 'component', sortKey: 'component', label: t('platformState.component'), sortable: true },
    { key: 'status', sortKey: 'status', label: t('platformState.status'), sortable: true },
    {
      key: 'lastSuccessfulRun',
      sortKey: 'lastSuccessfulRun',
      label: t('platformState.lastSuccessfulRun'),
      sortable: true,
    },
    { key: 'lastError', sortKey: 'lastError', label: t('platformState.lastError'), sortable: true },
    {
      key: 'errorInfo',
      sortKey: 'errorInfo',
      label: t('platformState.errorInfo'),
      sortable: true,
    },
    { key: 'actions', label: t('platformState.actions'), sortable: false },
  ];

  const formatTimestamp = (iso: string | null) => {
    if (!iso) return t('platformState.noErrors');
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-AU');
  };

  if (!isLoading && sortedComponents.length === 0) return null;

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">{t('platformState.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('platformState.subtitle')}</p>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {headers.map((header) => (
                  <th
                    key={header.key}
                    className={`px-3 py-2.5 text-xs font-bold tracking-wide ${header.key === 'actions' ? 'text-right' : 'text-left'} ${header.sortable ? 'cursor-pointer select-none' : ''}`}
                    onClick={
                      header.sortable && header.sortKey
                        ? () => handleSort(header.sortKey as SortKey)
                        : undefined
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      {header.label}
                      {header.sortable && header.sortKey && (
                        <SortIcon
                          active={sort.column === header.sortKey}
                          direction={sort.column === header.sortKey ? sort.direction : null}
                        />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedComponents.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-b-0 hover:bg-accent/50 transition-colors"
                >
                  <td className="px-3 py-3 text-foreground font-medium">{row.name}</td>
                  <td className="px-3 py-3">
                    <Badge
                      className={`rounded-full px-2 py-1 text-xs font-normal ${STATUS_COLORS[row.status] ?? ''}`}
                    >
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {formatTimestamp(row.lastSuccessfulRun)}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {formatTimestamp(row.lastError)}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground text-xs">
                    {row.errorInfo ?? t('platformState.noErrors')}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="View"
                        onClick={() => navigate(ROUTES.adminPanel)}
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      {canToggle(row) && (
                        <ToggleSwitch
                          checked={!isDisabled(row)}
                          onChange={() => toggleIntegration(row)}
                          aria-label={isDisabled(row) ? 'Enable' : 'Disable'}
                        />
                      )}
                      {canReload(row) && (
                        <button
                          type="button"
                          className={`p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors ${isReloading(row.id) ? 'animate-spin' : ''}`}
                          aria-label="Reload"
                          onClick={() => reloadComponent(row)}
                          disabled={isReloading(row.id)}
                        >
                          <CircleReloadIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
