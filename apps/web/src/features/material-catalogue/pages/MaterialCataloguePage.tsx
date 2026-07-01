import { type MaterialListItemDto, type MaterialListSummaryDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { Button, Input, TablePagination, useDebounce } from '@forethread/ui-components';
import DownloadIcon from '@forethread/ui-components/assets/icons/download.svg?react';
import PlusIcon from '@forethread/ui-components/assets/icons/plus.svg?react';
import SearchIcon from '@forethread/ui-components/assets/icons/search.svg?react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { usePermissions } from '@/shared/role';

import { AddToMaterialListModal } from '../components/AddToMaterialListModal';
import {
  ConfirmMaterialModal,
  type ConfirmMaterialAction,
} from '../components/ConfirmMaterialModal';
import { CreateEditMaterialListModal } from '../components/CreateEditMaterialListModal';
import { FacetFilterSelect } from '../components/FacetFilterSelect';
import { MaterialListsPanel } from '../components/MaterialListsPanel';
import { MaterialNoResults } from '../components/MaterialNoResults';
import { MaterialSearchDropdown } from '../components/MaterialSearchDropdown';
import { MaterialTable, type MaterialSortKey } from '../components/MaterialTable';
import { PendingApprovalList } from '../components/PendingApprovalList';
import { PendingChangeRequestCard } from '../components/PendingChangeRequestCard';
import {
  useMaterialChangeRequestMutations,
  useMaterialChangeRequests,
} from '../hooks/useMaterialChangeRequests';
import { useMaterialFacets } from '../hooks/useMaterialFacets';
import { useMaterialFavouriteMutations } from '../hooks/useMaterialFavouriteMutations';
import { useMaterialLists, useMaterialListMutations } from '../hooks/useMaterialLists';
import { useMaterialMutations } from '../hooks/useMaterialMutations';
import { useMaterialCategories, useMaterials } from '../hooks/useMaterials';
import {
  useFrequentlyUsedMaterials,
  useMaterialSearchSuggestions,
  useRecentMaterials,
} from '../hooks/useMaterialSearch';

// SA manages the public catalogue lifecycle; CA / PO contribute + curate lists.
type Tab = 'public' | 'pending' | 'archived' | 'favorites' | 'materialList';

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50];

interface PendingConfirm {
  action: ConfirmMaterialAction;
  material: MaterialListItemDto;
}

export default function MaterialCataloguePage() {
  const { t } = useTranslation(['materialCatalogue']);
  const { has } = usePermissions();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Surface the page title + subtitle in the global app header (matches Figma —
  // the catalogue header lives in AppLayout, not in-content). No back route for
  // the top-level catalogue page.
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(t('page.title'), t('page.subtitle'));
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  const canApprove = has('material.approve');
  // SA (approver) sees the lifecycle-management tabs; CA / PO see the
  // contributor view (favourites + material lists). US 4.03 surface is gated on
  // NOT being an approver so the Super-Admin catalogue stays exactly as-is.
  const showApprovalTabs = canApprove;
  const showContributorTabs = !canApprove;

  // Valid tab keys for the current role — drives both the tab bar and ?tab=
  // resolution so an out-of-role tab param falls back to 'public'.
  const validTabKeys: Tab[] = showApprovalTabs
    ? ['public', 'pending', 'archived']
    : ['public', 'favorites', 'materialList'];

  // ── Active tab (?tab=) ──────────────────────────────────────────────
  const tabParam = searchParams.get('tab') as Tab | null;
  const activeTab: Tab = tabParam && validTabKeys.includes(tabParam) ? tabParam : 'public';

  const setActiveTab = (tab: Tab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'public') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
    setPage(1);
  };

  // ── Filters / search / paging ───────────────────────────────────────
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [categoryId, setCategoryId] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [uom, setUom] = useState('');
  const [materialType, setMaterialType] = useState('');
  const [countryOfOrigin, setCountryOfOrigin] = useState('');
  const [sortBy, setSortBy] = useState<MaterialSortKey | undefined>(undefined);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);

  // Material-list tab (US 4.03) — its own search + modal state.
  const [listSearch, setListSearch] = useState('');
  const [addToListMaterial, setAddToListMaterial] = useState<MaterialListItemDto | null>(null);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [editList, setEditList] = useState<MaterialListSummaryDto | null>(null);
  const [deleteList, setDeleteList] = useState<MaterialListSummaryDto | null>(null);

  // Search autocomplete dropdown (US 4.04) — focus state + a short debounce so
  // suggestions fire while typing without hammering the endpoint.
  const [searchFocused, setSearchFocused] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(search, 400);
  const debouncedListSearch = useDebounce(listSearch, 400);
  const suggestionTerm = useDebounce(search.trim(), 250);

  const { data: categories } = useMaterialCategories();
  const { facets } = useMaterialFacets();
  const mutations = useMaterialMutations();

  // Suggestion data for the dropdown. Only the contributor table tabs show it,
  // and only while the input is focused with a non-empty query.
  const dropdownOpen = searchFocused && Boolean(suggestionTerm);
  const suggestionsQuery = useMaterialSearchSuggestions(suggestionTerm, {
    enabled: dropdownOpen,
  });
  const frequentlyUsed = useFrequentlyUsedMaterials(suggestionsQuery.data);
  const { recent: recentMaterials, record: recordRecentMaterial } = useRecentMaterials();

  // Prefer the locally-tracked recents (what the user opened from the dropdown);
  // fall back to the backend's recentlyUsed group before the user has any.
  const recentlyUsed =
    recentMaterials.length > 0 ? recentMaterials : (suggestionsQuery.data?.recentlyUsed ?? []);

  // Favourites (US 4.03) — optimistic star toggle for CA / PO.
  const canFavourite = has('material.favourite');
  const favouriteMutations = useMaterialFavouriteMutations();

  // Material lists (US 4.03) — only fetched on the contributor "Material list"
  // tab, gated on the list permission so SA never fires the request.
  const canListLists = has('materialList.list');
  const listsQuery = useMaterialLists(
    { search: debouncedListSearch.trim() || undefined },
    { enabled: showContributorTabs && canListLists && activeTab === 'materialList' },
  );
  const listMutations = useMaterialListMutations();

  // Edit-diff change requests (US 4.01 Phase 3). Only fetched for reviewers who
  // can list them, so non-Super-Admins never fire the request.
  const canListChangeRequests = has('material.listChangeRequests');
  const changeRequestsQuery = useMaterialChangeRequests(canListChangeRequests);
  const changeRequestMutations = useMaterialChangeRequestMutations();

  const baseParams = useMemo(
    () => ({
      page,
      limit: pageSize,
      search: debouncedSearch.trim() || undefined,
      categoryId: categoryId || undefined,
      manufacturer: manufacturer || undefined,
      uom: uom || undefined,
      materialType: materialType || undefined,
      countryOfOrigin: countryOfOrigin || undefined,
      sortBy,
      sortDir: sortBy ? sortDir : undefined,
    }),
    [
      page,
      pageSize,
      debouncedSearch,
      categoryId,
      manufacturer,
      uom,
      materialType,
      countryOfOrigin,
      sortBy,
      sortDir,
    ],
  );

  // The table-driven tabs (public / archived / favorites) share the filtered
  // params. Public + Favorite both list PUBLIC materials; Favorite additionally
  // restricts to the user's favourites. Archived lists archived materials. The
  // pending tab has its own minimal query so it stays a "new submissions" feed.
  const tableStatus = activeTab === 'archived' ? 'ARCHIVED' : 'PUBLIC';
  const tableQuery = useMaterials({
    ...baseParams,
    status: tableStatus,
    favourite: activeTab === 'favorites' ? true : undefined,
  });

  const pendingQuery = useMaterials({
    status: 'PENDING_APPROVAL',
    limit: 50,
    search: debouncedSearch.trim() || undefined,
  });

  const tableItems = tableQuery.data?.items ?? [];
  const total = tableQuery.data?.meta.total ?? 0;
  const searchActive = Boolean(debouncedSearch.trim());

  // A committed search that returned zero rows swaps the table + pagination for
  // the centered "No results found" empty state (US 4.04). Favourites uses its
  // own empty copy, so we only take over the search-zero case here.
  const showNoResults =
    searchActive && !tableQuery.isLoading && !tableQuery.isError && tableItems.length === 0;

  const handleSort = (key: MaterialSortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const openConfirm = (action: ConfirmMaterialAction, material: MaterialListItemDto) =>
    setConfirm({ action, material });

  // Preview a material from the search dropdown: remember it (Recently used) and
  // navigate to its detail page.
  const handleSearchSelect = (material: { id: string; name: string }) => {
    const groups = suggestionsQuery.data;
    const full = groups?.results.find((m) => m.id === material.id) ??
      groups?.frequentlyUsed.find((m) => m.id === material.id) ??
      groups?.recentlyUsed.find((m) => m.id === material.id) ??
      recentMaterials.find((m) => m.id === material.id) ?? {
        id: material.id,
        name: material.name,
        categoryName: null,
        uom: null,
        description: null,
        imageUrl: null,
      };
    recordRecentMaterial(full);
    setSearchFocused(false);
    navigate(buildDetailPath(material.id));
  };

  const runConfirm = () => {
    if (!confirm) return;
    const { action, material } = confirm;
    const onDone = () => setConfirm(null);
    if (action === 'archive') mutations.archive.mutate(material.id, { onSettled: onDone });
    else if (action === 'restore') mutations.restore.mutate(material.id, { onSettled: onDone });
    else mutations.remove.mutate(material.id, { onSettled: onDone });
  };

  const confirmLoading =
    mutations.archive.isPending || mutations.restore.isPending || mutations.remove.isPending;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'public', label: t('tabs.public') },
    ...(showApprovalTabs
      ? ([
          { key: 'pending', label: t('tabs.pending') },
          { key: 'archived', label: t('tabs.archived') },
        ] as { key: Tab; label: string }[])
      : []),
    ...(showContributorTabs
      ? ([
          { key: 'favorites', label: t('tabs.favorites') },
          { key: 'materialList', label: t('tabs.materialList') },
        ] as { key: Tab; label: string }[])
      : []),
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border">
        <div className="flex items-center gap-6" role="tablist" aria-label={t('page.title')}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                data-testid={`material-tab-${tab.key}`}
                className={
                  'pb-3 -mb-px text-sm font-medium border-b-2 transition-colors ' +
                  (isActive
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground')
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 pb-2">
          {has('material.create') && (
            <Button
              leftIcon={<PlusIcon className="w-4 h-4" />}
              onClick={() => navigate(ROUTES.materialCatalogueNew)}
              data-testid="material-create"
            >
              {t('actions.createNew')}
            </Button>
          )}
          {has('material.import') && (
            <Button
              variant="outline"
              leftIcon={<DownloadIcon className="w-4 h-4" />}
              onClick={() => navigate(ROUTES.materialCatalogueUpload)}
              data-testid="material-upload"
            >
              {t('actions.upload')}
            </Button>
          )}
        </div>
      </div>

      {activeTab === 'materialList' ? (
        <MaterialListsPanel
          lists={listsQuery.data ?? []}
          isLoading={listsQuery.isLoading}
          isError={listsQuery.isError}
          search={listSearch}
          permissions={{
            canCreate: has('materialList.create'),
            canEdit: has('materialList.update'),
            canDelete: has('materialList.delete'),
          }}
          onSearchChange={setListSearch}
          onCreate={() => setCreateListOpen(true)}
          onView={(list) => navigate(buildListDetailPath(list.id))}
          onEdit={(list) => setEditList(list)}
          onDelete={(list) => setDeleteList(list)}
        />
      ) : activeTab === 'pending' ? (
        <div className="space-y-8" data-testid="pending-tab">
          {/* New material submissions (Phase 1/2). */}
          <section className="space-y-3" aria-label={t('pending.sections.newSubmissions')}>
            <h2 className="text-sm font-semibold text-foreground">
              {t('pending.sections.newSubmissions')}
            </h2>
            <PendingApprovalList
              items={pendingQuery.data?.items ?? []}
              isLoading={pendingQuery.isLoading}
              isError={pendingQuery.isError}
              permissions={{
                canApprove: has('material.approve'),
                canReject: has('material.reject'),
              }}
              approvingId={mutations.approve.isPending ? mutations.approve.variables : undefined}
              rejectingId={mutations.reject.isPending ? mutations.reject.variables?.id : undefined}
              onView={(id) => navigate(buildDetailPath(id))}
              onApprove={(id) => mutations.approve.mutate(id)}
              onReject={(id) => mutations.reject.mutate({ id })}
            />
          </section>

          {/* Edit requests against PUBLIC materials (Phase 3). */}
          {canListChangeRequests && (
            <section className="space-y-3" aria-label={t('pending.sections.editRequests')}>
              <h2 className="text-sm font-semibold text-foreground">
                {t('pending.sections.editRequests')}
              </h2>
              {changeRequestsQuery.isLoading ? (
                <div className="py-8 text-center text-muted-foreground" role="status">
                  {t('pending.changeRequest.loading')}
                </div>
              ) : changeRequestsQuery.isError ? (
                <div className="py-8 text-center text-destructive" role="alert">
                  {t('pending.changeRequest.error')}
                </div>
              ) : (changeRequestsQuery.data?.length ?? 0) === 0 ? (
                <div
                  className="py-8 text-center text-muted-foreground"
                  data-testid="change-requests-empty"
                >
                  {t('pending.changeRequest.empty')}
                </div>
              ) : (
                <div className="space-y-4" data-testid="change-requests-list">
                  {changeRequestsQuery.data?.map((request) => (
                    <PendingChangeRequestCard
                      key={request.id}
                      request={request}
                      permissions={{
                        canApprove: has('material.approveChange'),
                        canReject: has('material.rejectChange'),
                      }}
                      isApproving={
                        changeRequestMutations.approve.isPending &&
                        changeRequestMutations.approve.variables === request.id
                      }
                      isRejecting={
                        changeRequestMutations.reject.isPending &&
                        changeRequestMutations.reject.variables?.id === request.id
                      }
                      onApprove={(id) => changeRequestMutations.approve.mutate(id)}
                      onReject={(id) => changeRequestMutations.reject.mutate({ id })}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div
              ref={searchWrapRef}
              className="relative w-full sm:w-72"
              onBlur={(e) => {
                // Close only when focus leaves the whole search region (input +
                // dropdown), so clicking a result still registers.
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setSearchFocused(false);
                }
              }}
            >
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
              <Input
                aria-label={t('page.searchLabel')}
                placeholder={t('page.searchPlaceholder')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchFocused(false);
                }}
                role="combobox"
                aria-expanded={dropdownOpen}
                aria-controls="material-search-dropdown"
                data-testid="material-search"
                className="pl-9"
              />
              {dropdownOpen && (
                <MaterialSearchDropdown
                  query={suggestionTerm}
                  results={suggestionsQuery.data?.results ?? []}
                  resultCount={suggestionsQuery.data?.results.length}
                  frequentlyUsed={frequentlyUsed.data}
                  recentlyUsed={recentlyUsed}
                  isLoading={suggestionsQuery.isLoading}
                  onSelect={handleSearchSelect}
                />
              )}
            </div>

            <FacetFilterSelect
              value={categoryId}
              onChange={(v) => {
                setCategoryId(v);
                setPage(1);
              }}
              placeholder={t('filters.allCategories')}
              testId="filter-category"
              options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
            <FacetFilterSelect
              value={manufacturer}
              onChange={(v) => {
                setManufacturer(v);
                setPage(1);
              }}
              placeholder={t('filters.manufacturer')}
              testId="filter-manufacturer"
              options={facets.manufacturers.map((m) => ({ value: m, label: m }))}
            />
            <FacetFilterSelect
              value={uom}
              onChange={(v) => {
                setUom(v);
                setPage(1);
              }}
              placeholder={t('filters.uom')}
              testId="filter-uom"
              options={facets.uoms.map((u) => ({ value: u, label: u }))}
            />
            <FacetFilterSelect
              value={materialType}
              onChange={(v) => {
                setMaterialType(v);
                setPage(1);
              }}
              placeholder={t('filters.materialType')}
              testId="filter-material-type"
              options={facets.materialTypes.map((m) => ({ value: m, label: m }))}
            />
            <FacetFilterSelect
              value={countryOfOrigin}
              onChange={(v) => {
                setCountryOfOrigin(v);
                setPage(1);
              }}
              placeholder={t('filters.countryOfOrigin')}
              testId="filter-country"
              options={facets.countriesOfOrigin.map((c) => ({ value: c, label: c }))}
            />
          </div>

          {showNoResults ? (
            <MaterialNoResults query={debouncedSearch.trim()} />
          ) : (
            <>
              <MaterialTable
                tab={activeTab === 'archived' ? 'archived' : 'public'}
                items={tableItems}
                isLoading={tableQuery.isLoading}
                isError={tableQuery.isError}
                searchActive={searchActive}
                searchQuery={debouncedSearch.trim()}
                emptyText={activeTab === 'favorites' ? t('favourites.empty') : undefined}
                permissions={{
                  canEdit: has('material.update'),
                  canArchive: has('material.archive'),
                  canRestore: has('material.restore'),
                  canDelete: has('material.delete'),
                }}
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
                onView={(id) => navigate(buildDetailPath(id))}
                onEdit={(id) => navigate(buildEditPath(id))}
                onArchive={(m) => openConfirm('archive', m)}
                onRestore={(m) => openConfirm('restore', m)}
                onDelete={(m) => openConfirm('delete', m)}
                onToggleFavourite={
                  showContributorTabs && canFavourite
                    ? (m) => favouriteMutations.toggle(m.id, Boolean(m.isFavourite))
                    : undefined
                }
                onAddToList={
                  showContributorTabs && has('materialList.manageItems')
                    ? (m) => setAddToListMaterial(m)
                    : undefined
                }
              />

              <TablePagination
                page={page}
                totalItems={total}
                pageSize={pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                rowsPerPageLabel={t('pagination.rowsPerPage')}
                showingLabel={({ from, to, total: tot }) =>
                  t('pagination.showing', { from, to, total: tot })
                }
                backLabel={t('pagination.back')}
                nextLabel={t('pagination.next')}
              />
            </>
          )}
        </>
      )}

      {confirm && (
        <ConfirmMaterialModal
          action={confirm.action}
          isLoading={confirmLoading}
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
        />
      )}

      {/* US 4.03 — add a material to one of the user's lists (from a row kebab). */}
      {addToListMaterial && (
        <AddToMaterialListModal
          material={{ id: addToListMaterial.id, name: addToListMaterial.name }}
          onClose={() => setAddToListMaterial(null)}
        />
      )}

      {/* US 4.03 — create a new material list. */}
      {createListOpen && (
        <CreateEditMaterialListModal
          isSubmitting={listMutations.create.isPending}
          onClose={() => setCreateListOpen(false)}
          onSubmit={(values) =>
            listMutations.create.mutate(values, { onSuccess: () => setCreateListOpen(false) })
          }
        />
      )}

      {/* US 4.03 — edit an existing material list. */}
      {editList && (
        <CreateEditMaterialListModal
          list={editList}
          isSubmitting={listMutations.update.isPending}
          onClose={() => setEditList(null)}
          onSubmit={(values) =>
            listMutations.update.mutate(
              { id: editList.id, input: values },
              { onSuccess: () => setEditList(null) },
            )
          }
        />
      )}

      {/* US 4.03 — confirm deleting a material list. */}
      {deleteList && (
        <ConfirmMaterialModal
          action="delete"
          title={t('materialLists.deleteConfirm.title')}
          body={t('materialLists.deleteConfirm.body')}
          confirmLabel={t('materialLists.deleteConfirm.confirm')}
          isLoading={listMutations.remove.isPending}
          onConfirm={() =>
            listMutations.remove.mutate(deleteList.id, { onSettled: () => setDeleteList(null) })
          }
          onClose={() => setDeleteList(null)}
        />
      )}
    </div>
  );
}

function buildDetailPath(id: string): string {
  return ROUTES.materialCatalogueDetail.replace(':id', id);
}

function buildEditPath(id: string): string {
  return ROUTES.materialCatalogueEdit.replace(':id', id);
}

function buildListDetailPath(id: string): string {
  return ROUTES.materialCatalogueListDetail.replace(':id', id);
}
