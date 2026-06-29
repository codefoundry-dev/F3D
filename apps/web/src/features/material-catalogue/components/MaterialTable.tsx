import { type MaterialListItemDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Badge, DotActionsMenu, type DotAction } from '@forethread/ui-components';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
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
  /** The active search term, echoed into the in-table "no results" copy. */
  searchQuery?: string;
  /** Overrides the default "no materials yet" empty-state copy (e.g. favourites). */
  emptyText?: string;
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
  /**
   * When supplied, a leading star column is rendered (CA / PO favourites view,
   * US 4.03). Toggles the material's favourite state.
   */
  onToggleFavourite?: (material: MaterialListItemDto) => void;
  /** When supplied, the row kebab gains an "Add to material list" action (US 4.03). */
  onAddToList?: (material: MaterialListItemDto) => void;
  /**
   * When supplied, a remove (X) action is rendered in the row (material-list
   * detail variant, US 4.03). Receives the material so the caller can map it
   * back to its list-item id.
   */
  onRemoveFromList?: (material: MaterialListItemDto) => void;
}

/** A filled (favourited) or outline (not) star, used by the favourites column. */
function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-4 h-4"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2.5l2.9 5.88 6.5.95-4.7 4.58 1.11 6.47L12 17.84 6.19 20.9l1.1-6.47-4.69-4.58 6.5-.95L12 2.5z" />
    </svg>
  );
}

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
  searchQuery,
  emptyText,
  permissions,
  sortBy,
  sortDir,
  onSort,
  onView,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  onToggleFavourite,
  onAddToList,
  onRemoveFromList,
}: MaterialTableProps) {
  const { t } = useTranslation(['materialCatalogue']);

  const showStarColumn = Boolean(onToggleFavourite);
  // Base columns = 12; +1 when the leading favourites star column is shown.
  const columnCount = 12 + (showStarColumn ? 1 : 0);

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
    if (onAddToList) {
      actions.push({
        key: 'add-to-list',
        label: t('addToList.menuLabel'),
        onClick: () => onAddToList(material),
      });
    }
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
            {showStarColumn && (
              <th className="w-10 px-3 py-3">
                <span className="sr-only">{t('favourites.add')}</span>
              </th>
            )}
            <SortHeader label={t('table.columns.material')} sortKey="name" />
            <SortHeader label={t('table.columns.category')} />
            <SortHeader label={t('table.columns.materialType')} />
            <SortHeader label={t('table.columns.status')} />
            <SortHeader label={t('table.columns.manufacturer')} />
            <SortHeader label={t('table.columns.uom')} />
            <SortHeader label={t('table.columns.upc')} />
            <SortHeader label={t('table.columns.costCode')} />
            <SortHeader label={t('table.columns.taxCode')} />
            <SortHeader label={t('table.columns.lastPrice')} />
            <SortHeader label={t('table.columns.updated')} sortKey="updatedAt" />
            <th className="text-left px-3 py-3 whitespace-nowrap">{t('table.columns.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={columnCount} className="px-3 py-8 text-center text-muted-foreground">
                <span role="status">{t('table.loading')}</span>
              </td>
            </tr>
          ) : isError ? (
            <tr>
              <td colSpan={columnCount} className="px-3 py-8 text-center text-destructive">
                <span role="alert">{t('table.error')}</span>
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className="px-3 py-8 text-center text-muted-foreground">
                {searchActive
                  ? searchQuery
                    ? t('search.noResultsBody', { query: searchQuery })
                    : t('table.noResults')
                  : (emptyText ?? t('table.empty'))}
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
                  {showStarColumn && (
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => onToggleFavourite?.(material)}
                        className={
                          'p-1 rounded-lg hover:bg-accent transition-colors ' +
                          (material.isFavourite
                            ? 'text-foreground'
                            : 'text-muted-foreground hover:text-foreground')
                        }
                        aria-label={
                          material.isFavourite ? t('favourites.remove') : t('favourites.add')
                        }
                        aria-pressed={Boolean(material.isFavourite)}
                        data-testid={`material-favourite-${material.id}`}
                      >
                        <StarIcon filled={Boolean(material.isFavourite)} />
                      </button>
                    </td>
                  )}
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
                  <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                    {material.costCode ?? '—'}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                    {material.taxCode ?? '—'}
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
                      {onRemoveFromList && (
                        <button
                          type="button"
                          onClick={() => onRemoveFromList(material)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-accent"
                          aria-label={t('listDetail.removeItem')}
                          data-testid={`material-remove-${material.id}`}
                        >
                          <CrossIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {actions.length > 0 && (
                        <DotActionsMenu actions={actions} bordered={false} menuClassName="w-48" />
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
