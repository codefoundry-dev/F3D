import { type MaterialListSummaryDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Button, DotActionsMenu, type DotAction, Input } from '@forethread/ui-components';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import PlusIcon from '@forethread/ui-components/assets/icons/plus.svg?react';
import SearchIcon from '@forethread/ui-components/assets/icons/search.svg?react';

export interface MaterialListsPanelPermissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface MaterialListsPanelProps {
  lists: MaterialListSummaryDto[];
  isLoading: boolean;
  isError: boolean;
  search: string;
  permissions: MaterialListsPanelPermissions;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  onView: (list: MaterialListSummaryDto) => void;
  onEdit: (list: MaterialListSummaryDto) => void;
  onDelete: (list: MaterialListSummaryDto) => void;
}

/**
 * The catalogue "Material list" tab (US 4.03): a "Create material list" button +
 * search, then a stack of list cards (package icon, name, description, view +
 * edit icons, optional delete kebab). Matches the Figma material-list tab.
 */
export function MaterialListsPanel({
  lists,
  isLoading,
  isError,
  search,
  permissions,
  onSearchChange,
  onCreate,
  onView,
  onEdit,
  onDelete,
}: MaterialListsPanelProps) {
  const { t } = useTranslation(['materialCatalogue']);
  const searchActive = Boolean(search.trim());

  function cardActions(list: MaterialListSummaryDto): DotAction[] {
    const actions: DotAction[] = [];
    if (permissions.canDelete) {
      actions.push({
        key: 'delete',
        label: t('materialLists.delete'),
        onClick: () => onDelete(list),
      });
    }
    return actions;
  }

  return (
    <div className="space-y-4" data-testid="material-lists-panel">
      <div className="flex items-center justify-end gap-3">
        {permissions.canCreate && (
          <Button
            variant="outline"
            leftIcon={<PlusIcon className="w-4 h-4" />}
            onClick={onCreate}
            data-testid="material-lists-create"
          >
            {t('materialLists.createButton')}
          </Button>
        )}
        <div className="relative w-full sm:w-72">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('page.searchPlaceholder')}
            aria-label={t('materialLists.searchLabel')}
            data-testid="material-lists-search"
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <p role="status" className="py-12 text-center text-muted-foreground">
          {t('materialLists.loading')}
        </p>
      ) : isError ? (
        <p role="alert" className="py-12 text-center text-destructive">
          {t('materialLists.error')}
        </p>
      ) : lists.length === 0 ? (
        <div className="py-12 text-center" data-testid="material-lists-empty">
          <p className="text-muted-foreground">
            {searchActive ? t('materialLists.noResults') : t('materialLists.empty')}
          </p>
          {!searchActive && (
            <p className="mt-1 text-sm text-muted-foreground">{t('materialLists.emptyHint')}</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => {
            const actions = cardActions(list);
            return (
              <div
                key={list.id}
                data-testid={`material-list-card-${list.id}`}
                className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
              >
                <span className="flex items-center justify-center w-11 h-11 rounded-lg bg-muted text-muted-foreground flex-shrink-0">
                  <PackageIcon className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground truncate">{list.name}</p>
                  {list.description && (
                    <p className="text-sm text-muted-foreground truncate">{list.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onView(list)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                    aria-label={t('materialLists.view')}
                    data-testid={`material-list-view-${list.id}`}
                  >
                    <EyeIcon className="w-4 h-4" />
                  </button>
                  {permissions.canEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(list)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                      aria-label={t('materialLists.edit')}
                      data-testid={`material-list-edit-${list.id}`}
                    >
                      <EditIcon className="w-4 h-4" />
                    </button>
                  )}
                  {actions.length > 0 && (
                    <DotActionsMenu actions={actions} bordered={false} menuClassName="w-40" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
