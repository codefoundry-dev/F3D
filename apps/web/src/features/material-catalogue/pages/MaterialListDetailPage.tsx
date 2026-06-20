import { type MaterialListEntryDto, type MaterialListItemDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { Button, Input } from '@forethread/ui-components';
import BackArrowIcon from '@forethread/ui-components/assets/icons/back-arrow.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import PlusIcon from '@forethread/ui-components/assets/icons/plus.svg?react';
import SearchIcon from '@forethread/ui-components/assets/icons/search.svg?react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { usePermissions } from '@/shared/role';

import { AddMaterialsToListModal } from '../components/AddMaterialsToListModal';
import { CreateEditMaterialListModal } from '../components/CreateEditMaterialListModal';
import { MaterialTable } from '../components/MaterialTable';
import { useMaterialList, useMaterialListMutations } from '../hooks/useMaterialLists';

/**
 * Project a list entry's nested material onto the MaterialListItemDto shape so
 * the shared MaterialTable can render it. The entry id (not the material id) is
 * what the remove-item endpoint needs, so we map it back via a lookup.
 */
function entryToRow(entry: MaterialListEntryDto): MaterialListItemDto {
  const m = entry.material;
  return {
    id: m.id,
    name: m.name,
    categoryId: m.category?.id ?? null,
    categoryName: m.category?.name ?? null,
    status: m.status,
    createdAt: m.updatedAt,
    updatedAt: m.updatedAt,
    uom: m.uom,
    manufacturer: m.manufacturer,
    description: m.description,
    materialType: m.materialType,
    upc: m.upc,
    pricePerUnit: m.pricePerUnit,
    currency: m.currency,
    imageUrl: m.imageUrl,
  };
}

export default function MaterialListDetailPage() {
  const { t } = useTranslation(['materialCatalogue']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { has } = usePermissions();

  const { data: list, isLoading, isError } = useMaterialList(id);
  const { update, removeItem } = useMaterialListMutations();

  const [search, setSearch] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const canManageItems = has('materialList.manageItems');
  const canUpdate = has('materialList.update');
  const canEditMaterial = has('material.update');

  // Title the page in the global app header (Figma renders the list name +
  // subtitle there with a back arrow to the Material list tab), not in-content.
  const backRoute = `${ROUTES.materialCatalogue}?tab=materialList`;
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    if (!list) return;
    setPageTitle(list.name, list.description ?? t('listDetail.subtitle'), backRoute);
    return () => setPageTitle(null);
  }, [setPageTitle, list, t, backRoute]);

  // material.id → list-entry id, so remove-X can resolve the item to delete.
  const entryByMaterialId = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of list?.items ?? []) map.set(entry.material.id, entry.id);
    return map;
  }, [list]);

  const rows = useMemo(() => {
    const all = (list?.items ?? []).map(entryToRow);
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        (m.categoryName ?? '').toLowerCase().includes(term) ||
        (m.manufacturer ?? '').toLowerCase().includes(term),
    );
  }, [list, search]);

  if (isLoading) {
    return (
      <div className="p-8">
        <p role="status" className="text-muted-foreground">
          {t('listDetail.loading')}
        </p>
      </div>
    );
  }

  if (isError || !list) {
    return (
      <div className="p-8 space-y-4">
        <button
          type="button"
          onClick={() => navigate(ROUTES.materialCatalogue)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <BackArrowIcon className="w-4 h-4" />
          {t('listDetail.back')}
        </button>
        <p role="alert" className="text-destructive">
          {t('listDetail.notFound')}
        </p>
      </div>
    );
  }

  const existingMaterialIds = list.items.map((entry) => entry.material.id);

  return (
    <div className="p-8 space-y-6" data-testid="material-list-detail-page">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('listDetail.searchPlaceholder')}
            aria-label={t('listDetail.search')}
            data-testid="material-list-detail-search"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          {canManageItems && (
            <Button
              leftIcon={<PlusIcon className="w-4 h-4" />}
              onClick={() => setShowAdd(true)}
              data-testid="material-list-detail-add"
            >
              {t('listDetail.addMaterial')}
            </Button>
          )}
          {canUpdate && (
            <Button
              variant="outline"
              leftIcon={<EditIcon className="w-4 h-4" />}
              onClick={() => setShowEdit(true)}
              data-testid="material-list-detail-edit"
            >
              {t('listDetail.edit')}
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 && !search.trim() ? (
        <div
          className="py-12 text-center border border-border rounded-xl bg-card"
          data-testid="material-list-detail-empty"
        >
          <p className="text-muted-foreground">{t('listDetail.empty')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('listDetail.emptyHint')}</p>
        </div>
      ) : (
        <MaterialTable
          tab="public"
          items={rows}
          isLoading={false}
          isError={false}
          searchActive={Boolean(search.trim())}
          searchQuery={search.trim()}
          permissions={{
            canEdit: canEditMaterial,
            canArchive: false,
            canRestore: false,
            canDelete: false,
          }}
          onView={(materialId) =>
            navigate(ROUTES.materialCatalogueDetail.replace(':id', materialId))
          }
          onEdit={(materialId) => navigate(ROUTES.materialCatalogueEdit.replace(':id', materialId))}
          onArchive={() => undefined}
          onRestore={() => undefined}
          onDelete={() => undefined}
          onRemoveFromList={
            canManageItems
              ? (material) => {
                  const itemId = entryByMaterialId.get(material.id);
                  if (itemId && id) removeItem.mutate({ id, itemId });
                }
              : undefined
          }
        />
      )}

      {showEdit && (
        <CreateEditMaterialListModal
          list={{ id: list.id, name: list.name, description: list.description }}
          isSubmitting={update.isPending}
          onClose={() => setShowEdit(false)}
          onSubmit={(values) => {
            if (!id) return;
            update.mutate({ id, input: values }, { onSuccess: () => setShowEdit(false) });
          }}
        />
      )}

      {showAdd && id && (
        <AddMaterialsToListModal
          listId={id}
          existingMaterialIds={existingMaterialIds}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
