import { type MaterialListItemDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Badge, DotActionsMenu, type DotAction } from '@forethread/ui-components';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import SortAscIcon from '@forethread/ui-components/assets/icons/sort-asc.svg?react';
import SortDescIcon from '@forethread/ui-components/assets/icons/sort-desc.svg?react';
import SortUnsortedIcon from '@forethread/ui-components/assets/icons/sort-unsorted.svg?react';

import { formatPrice, formatShortDate } from '../lib/format';

import { MaterialStatusBadge } from './MaterialStatusBadge';

export type MaterialSortKey = 'name' | 'createdAt' | 'updatedAt';
type SortDir = 'asc' | 'desc';

export interface MaterialTablePermissions {
  canEdit: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canDelete: boolean;
}

export interface MaterialTableProps {
  /** Which lifecycle tab the table is rendering — drives the kebab actions. */
  tab: 'public' | 'archived';
  items: MaterialListItemDto[];
  isLoading: boolean;
  isError: boolean;
  searchActive: boolean;
  permissions: MaterialTablePermissions;
  sortBy?: string;
  sortDir?: SortDir;
  /** null toggles the column off; a key sets it ascending then descending. */
  onSort?: (key: MaterialSortKey) => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onArchive: (material: MaterialListItemDto) => void;
  onRestore: (material: MaterialListItemDto) => void;
  onDelete: (material: MaterialListItemDto) => void;
}

const COLUMN_COUNT = 10;

function ImageThumb({ url, alt }: { url?: string | null; alt: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt={alt}
        className="w-8 h-8 rounded object-cover border border-border flex-shrink-0"
      />
    );
  }
  return (
    <span
      className="w-8 h-8 rounded bg-muted border border-border flex items-center justify-center flex-shrink-0 text-muted-foreground"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="w-4 h-4"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    </span>
  );
}

export function MaterialTable({
  tab,
  items,
  isLoading,
  isError,
  searchActive,
  permissions,
  sortBy,
  sortDir,
  onSort,
  onView,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: MaterialTableProps) {
  const { t } = useTranslation(['materialCatalogue']);

  function SortHeader({
    label,
    sortKey,
    className,
  }: {
    label: string;
    sortKey?: MaterialSortKey;
    className?: string;
  }) {
    const sortable = Boolean(sortKey && onSort);
    const active = sortable && sortBy === sortKey;
    const Icon = !active ? SortUnsortedIcon : sortDir === 'asc' ? SortAscIcon : SortDescIcon;

    return (
      <th className={className ?? 'text-left px-3 py-3 whitespace-nowrap'}>
        {sortable ? (
          <button
            type="button"
            onClick={() => sortKey && onSort?.(sortKey)}
            className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
            aria-label={t('table.sortBy', { column: label })}
          >
            {label}
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        ) : (
          <span className="inline-flex items-center gap-1">
            {label}
            <SortUnsortedIcon className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
          </span>
        )}
      </th>
    );
  }

  function rowActions(material: MaterialListItemDto): DotAction[] {
    const actions: DotAction[] = [];
    if (tab === 'public' && permissions.canArchive) {
      actions.push({
        key: 'archive',
        label: t('actions.archive'),
        onClick: () => onArchive(material),
      });
    }
    if (tab === 'archived' && permissions.canRestore) {
      actions.push({
        key: 'restore',
        label: t('actions.restore'),
        onClick: () => onRestore(material),
      });
    }
    if (permissions.canDelete) {
      actions.push({
        key: 'delete',
        label: t('actions.delete'),
        onClick: () => onDelete(material),
      });
    }
    return actions;
  }

  return (
    <div className="overflow-x-auto border border-border rounded-xl bg-card">
      <table className="w-full text-sm" data-testid="material-table">
        <thead className="bg-muted/40 text-xs text-muted-foreground border-b border-border">
          <tr>
            <SortHeader label={t('table.columns.material')} sortKey="name" />
            <SortHeader label={t('table.columns.category')} />
            <SortHeader label={t('table.columns.materialType')} />
            <SortHeader label={t('table.columns.status')} />
            <SortHeader label={t('table.columns.manufacturer')} />
            <SortHeader label={t('table.columns.uom')} />
            <SortHeader label={t('table.columns.upc')} />
            <SortHeader label={t('table.columns.lastPrice')} />
            <SortHeader label={t('table.columns.updated')} sortKey="updatedAt" />
            <th className="text-left px-3 py-3 whitespace-nowrap">{t('table.columns.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={COLUMN_COUNT} className="px-3 py-8 text-center text-muted-foreground">
                <span role="status">{t('table.loading')}</span>
              </td>
            </tr>
          ) : isError ? (
            <tr>
              <td colSpan={COLUMN_COUNT} className="px-3 py-8 text-center text-destructive">
                <span role="alert">{t('table.error')}</span>
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={COLUMN_COUNT} className="px-3 py-8 text-center text-muted-foreground">
                {searchActive ? t('table.noResults') : t('table.empty')}
              </td>
            </tr>
          ) : (
            items.map((material) => {
              const actions = rowActions(material);
              return (
                <tr
                  key={material.id}
                  data-testid={`material-row-${material.id}`}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <ImageThumb url={material.imageUrl} alt={material.name} />
                      <span className="font-medium text-foreground truncate" title={material.name}>
                        {material.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground truncate max-w-[140px]">
                    {material.categoryName ?? '—'}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {material.materialType ?? '—'}
                  </td>
                  <td className="px-3 py-3">
                    <MaterialStatusBadge status={material.status} />
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {material.manufacturer ?? '—'}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{material.uom ?? '—'}</td>
                  <td className="px-3 py-3">
                    {material.upc ? (
                      <Badge className="bg-muted text-muted-foreground">{material.upc}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-foreground whitespace-nowrap">
                    {formatPrice(material.pricePerUnit, material.currency)}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                    {formatShortDate(material.updatedAt)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onView(material.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                        aria-label={t('actions.view')}
                        data-testid={`material-view-${material.id}`}
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      {permissions.canEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(material.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                          aria-label={t('actions.edit')}
                          data-testid={`material-edit-${material.id}`}
                        >
                          <EditIcon className="w-4 h-4" />
                        </button>
                      )}
                      {actions.length > 0 && (
                        <DotActionsMenu actions={actions} bordered={false} menuClassName="w-40" />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
