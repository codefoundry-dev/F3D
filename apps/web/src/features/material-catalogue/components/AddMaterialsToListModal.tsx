import { type MaterialListItemDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Button,
  FilterPanel,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalIconHeader,
  Select,
  useDebounce,
} from '@forethread/ui-components';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import PlusInCircleIcon from '@forethread/ui-components/assets/icons/plus-in-circle.svg?react';
import SearchIcon from '@forethread/ui-components/assets/icons/search.svg?react';
import { useMemo, useState } from 'react';

import { useMaterialFacets } from '../hooks/useMaterialFacets';
import { useMaterialListMutations } from '../hooks/useMaterialLists';
import { useMaterialCategories, useMaterials } from '../hooks/useMaterials';

export interface AddMaterialsToListModalProps {
  listId: string;
  /** Materials already in the list — excluded from the browse results. */
  existingMaterialIds: string[];
  onClose: () => void;
}

type View = 'browse' | 'selected';

/** One browsable / selected catalogue row (thumb, name, category chip, meta, description). */
function MaterialRow({
  material,
  trailing,
}: {
  material: MaterialListItemDto;
  trailing: React.ReactNode;
}) {
  return (
    <div
      className="flex items-start gap-3 p-3 rounded-xl border border-border"
      data-testid={`add-materials-row-${material.id}`}
    >
      <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted text-muted-foreground flex-shrink-0">
        <PackageIcon className="w-5 h-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate">{material.name}</span>
          {material.categoryName && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex-shrink-0">
              {material.categoryName}
            </span>
          )}
        </div>
        {material.manufacturer && (
          <p className="text-sm text-muted-foreground truncate">{material.manufacturer}</p>
        )}
        {material.uom && <p className="text-sm text-muted-foreground truncate">{material.uom}</p>}
        {material.description && (
          <p className="text-sm text-muted-foreground truncate">{material.description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{trailing}</div>
    </div>
  );
}

/**
 * "Add to Material list" browser (US 4.03) — opened from a list-detail "Add
 * material" button. Browse the catalogue (search + filters) and ⊕-select rows;
 * a "Selected items (n)" / "View" toggle switches to the selected list (trash to
 * deselect). Submit adds every selected material to the list. Matches the Figma
 * add-materials modal.
 */
export function AddMaterialsToListModal({
  listId,
  existingMaterialIds,
  onClose,
}: AddMaterialsToListModalProps) {
  const { t } = useTranslation(['materialCatalogue']);
  const { addItems } = useMaterialListMutations();

  const [view, setView] = useState<View>('browse');
  const [search, setSearch] = useState('');
  // Map keeps the full material so the "Selected" view can render rows without a refetch.
  const [selected, setSelected] = useState<Map<string, MaterialListItemDto>>(new Map());

  // Facet filters — mirror the catalogue's own filters ("Filter as in material
  // catalog", per the Figma annotation): a category dropdown + free-text facets.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [uom, setUom] = useState('');
  const [materialType, setMaterialType] = useState('');
  const [countryOfOrigin, setCountryOfOrigin] = useState('');

  const debouncedSearch = useDebounce(search, 400);
  const existing = useMemo(() => new Set(existingMaterialIds), [existingMaterialIds]);
  const { data: categories } = useMaterialCategories();
  const { facets } = useMaterialFacets();

  const hasActiveFilters = Boolean(
    categoryId || manufacturer || uom || materialType || countryOfOrigin,
  );
  const clearFilters = () => {
    setCategoryId('');
    setManufacturer('');
    setUom('');
    setMaterialType('');
    setCountryOfOrigin('');
  };

  const { data, isLoading, isError } = useMaterials({
    page: 1,
    limit: 25,
    status: 'PUBLIC',
    search: debouncedSearch.trim() || undefined,
    categoryId: categoryId || undefined,
    manufacturer: manufacturer || undefined,
    uom: uom || undefined,
    materialType: materialType || undefined,
    countryOfOrigin: countryOfOrigin || undefined,
  });

  // Hide materials already in the list; the modal only adds new ones.
  const browseItems = (data?.items ?? []).filter((m) => !existing.has(m.id));
  const selectedItems = Array.from(selected.values());
  const searchActive = Boolean(debouncedSearch.trim());

  const toggleSelect = (material: MaterialListItemDto) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(material.id)) next.delete(material.id);
      else next.set(material.id, material);
      return next;
    });
  };

  const handleSubmit = () => {
    if (selected.size === 0) return;
    addItems.mutate(
      { id: listId, materialIds: Array.from(selected.keys()) },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl" scrollBody>
      <ModalBody>
        <ModalIconHeader
          icon={<PackageIcon className="w-6 h-6 text-foreground" />}
          title={
            <span className="text-lg font-semibold">{t('addMaterialsToListModal.title')}</span>
          }
          subtitle={
            <span className="text-sm text-muted-foreground">
              {t('addMaterialsToListModal.subtitle')}
            </span>
          }
          onClose={onClose}
          className="mb-6"
        />

        {/* View toggle: "Selected items (n)" ⇄ "Browse" */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">
            {t('addMaterialsToListModal.selectedItems', { count: selected.size })}
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setView((v) => (v === 'browse' ? 'selected' : 'browse'))}
            data-testid="add-materials-toggle-view"
          >
            {view === 'browse'
              ? t('addMaterialsToListModal.view')
              : t('addMaterialsToListModal.browse')}
          </Button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('addMaterialsToListModal.searchPlaceholder')}
            aria-label={t('addMaterialsToListModal.searchPlaceholder')}
            leftIcon={<SearchIcon className="w-4 h-4" />}
            data-testid="add-materials-search"
          />
          <FilterPanel
            label={t('addMaterialsToListModal.filters')}
            title={t('addMaterialsToListModal.filters')}
            fullWidth={false}
            width="360px"
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            onClearAll={hasActiveFilters ? clearFilters : undefined}
            clearAllLabel={t('addMaterialsToListModal.clearFilters')}
          >
            <div className="space-y-3" data-testid="add-materials-filters">
              <FacetSelect
                value={categoryId}
                onChange={setCategoryId}
                placeholder={t('filters.allCategories')}
                testId="add-materials-filter-category"
                options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
              />
              <FacetSelect
                value={manufacturer}
                onChange={setManufacturer}
                placeholder={t('filters.manufacturer')}
                testId="add-materials-filter-manufacturer"
                options={facets.manufacturers.map((m) => ({ value: m, label: m }))}
              />
              <FacetSelect
                value={uom}
                onChange={setUom}
                placeholder={t('filters.uom')}
                testId="add-materials-filter-uom"
                options={facets.uoms.map((u) => ({ value: u, label: u }))}
              />
              <FacetSelect
                value={materialType}
                onChange={setMaterialType}
                placeholder={t('filters.materialType')}
                testId="add-materials-filter-material-type"
                options={facets.materialTypes.map((m) => ({ value: m, label: m }))}
              />
              <FacetSelect
                value={countryOfOrigin}
                onChange={setCountryOfOrigin}
                placeholder={t('filters.countryOfOrigin')}
                testId="add-materials-filter-country"
                options={facets.countriesOfOrigin.map((c) => ({ value: c, label: c }))}
              />
            </div>
          </FilterPanel>
        </div>

        {view === 'browse' ? (
          <div className="space-y-2" data-testid="add-materials-browse">
            {isLoading ? (
              <p role="status" className="py-8 text-center text-muted-foreground">
                {t('addMaterialsToListModal.loading')}
              </p>
            ) : isError ? (
              <p role="alert" className="py-8 text-center text-destructive">
                {t('addMaterialsToListModal.error')}
              </p>
            ) : browseItems.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                {searchActive
                  ? t('addMaterialsToListModal.noResults')
                  : t('addMaterialsToListModal.empty')}
              </p>
            ) : (
              browseItems.map((material) => {
                const isSelected = selected.has(material.id);
                return (
                  <MaterialRow
                    key={material.id}
                    material={material}
                    trailing={
                      <button
                        type="button"
                        onClick={() => toggleSelect(material)}
                        aria-pressed={isSelected}
                        aria-label={
                          isSelected
                            ? t('addMaterialsToListModal.remove')
                            : t('addMaterialsToListModal.add')
                        }
                        className={
                          'p-1 rounded-full transition-colors ' +
                          (isSelected
                            ? 'text-foreground'
                            : 'text-muted-foreground hover:text-foreground')
                        }
                        data-testid={`add-materials-select-${material.id}`}
                      >
                        <PlusInCircleIcon className="w-6 h-6" />
                      </button>
                    }
                  />
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-2" data-testid="add-materials-selected">
            {selectedItems.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                {t('addMaterialsToListModal.noneSelected')}
              </p>
            ) : (
              selectedItems.map((material) => (
                <MaterialRow
                  key={material.id}
                  material={material}
                  trailing={
                    <button
                      type="button"
                      onClick={() => toggleSelect(material)}
                      aria-label={t('addMaterialsToListModal.remove')}
                      className="p-1 rounded-lg text-muted-foreground hover:text-destructive"
                      data-testid={`add-materials-deselect-${material.id}`}
                    >
                      <DeleteIcon className="w-4 h-4" />
                    </button>
                  }
                />
              ))
            )}
          </div>
        )}
      </ModalBody>

      <ModalFooter className="justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          data-testid="add-materials-cancel"
        >
          {t('addMaterialsToListModal.cancel')}
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          isLoading={addItems.isPending}
          disabled={selected.size === 0}
          data-testid="add-materials-submit"
        >
          {addItems.isPending
            ? t('addMaterialsToListModal.submitting')
            : t('addMaterialsToListModal.submit')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

interface FacetSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  testId: string;
  options: { value: string; label: string }[];
}

/**
 * A facet dropdown for the add-materials filters — "Filter as in material
 * catalog" per the Figma annotation, so these mirror the catalogue's dropdowns.
 * Renders gracefully (placeholder only) when a facet has no values.
 */
function FacetSelect({ value, onChange, placeholder, testId, options }: FacetSelectProps) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={placeholder}
      data-testid={testId}
      className="w-full rounded-xl"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
