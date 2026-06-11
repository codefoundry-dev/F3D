import { useTranslation } from '@forethread/i18n';
import { Button, Modal, ModalIconHeader, Spinner, cn } from '@forethread/ui-components';
import CaretLeftIcon from '@forethread/ui-components/assets/icons/caret-left.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import PlusInCircleIcon from '@forethread/ui-components/assets/icons/plus-in-circle.svg?react';
import SearchIcon from '@forethread/ui-components/assets/icons/search.svg?react';
import { useMemo, useState, type ReactNode } from 'react';

/* ─── Shared types ────────────────────────────────────────────────── */

/** A pickable source container (a BOM or a material list). */
export interface SourceEntity {
  id: string;
  name: string;
  description?: string;
}

/** A pickable item inside a source container. */
export interface SourceItem {
  id: string;
  name: string;
  /** Catalogue material the item resolves to (if matched/linked). */
  materialId?: string;
  manufacturer?: string;
  uom?: string;
  description?: string;
  category?: string;
  /** Quantity carried by the source (BOM qty / list qty). */
  sourceQuantity?: number;
  /** Project the item belongs to (BOM items). */
  projectId?: string;
}

/** An item the user has picked, with editable qty/uom. */
export interface PickedSourceItem extends SourceItem {
  entityId: string;
  quantity: number;
  pickedUom: string;
}

interface SourceTexts {
  title: string;
  subtitle: string;
  /** Default quantity for a freshly picked item (design annotations differ
   * between BOM — "exact qty as on BOM" — and material list — "1 qty"). */
  defaultQuantity: (item: SourceItem) => number;
}

/* ─── Row primitives ──────────────────────────────────────────────── */

function ItemIcon() {
  return (
    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
      <PackageIcon className="w-5 h-5 text-muted-foreground" />
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative flex-1">
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40"
      />
    </div>
  );
}

function SelectionBarRow({
  count,
  onClear,
  action,
}: {
  count: number;
  onClear: () => void;
  action?: ReactNode;
}) {
  const { t } = useTranslation('rfqs');
  if (count === 0) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-muted/40 rounded-lg">
      <button
        type="button"
        onClick={onClear}
        className="flex items-center gap-2 text-sm text-foreground hover:text-destructive transition-colors"
        data-testid="picker-clear-selection"
      >
        <CrossInCircleIcon className="w-4 h-4" />
        {t('create.picker.itemsSelected', { count })}
      </button>
      {action}
    </div>
  );
}

/* ─── Entity list phase ───────────────────────────────────────────── */

function EntityListPhase({
  entities,
  isLoading,
  selectable,
  selectedIds,
  onToggleEntity,
  onSelectAll,
  onDrillIn,
  emptyLabel,
}: {
  entities: SourceEntity[];
  isLoading: boolean;
  /** Convert mode: whole entities can be selected. */
  selectable: boolean;
  selectedIds: Set<string>;
  onToggleEntity: (id: string, selected: boolean) => void;
  onSelectAll: (ids: string[]) => void;
  onDrillIn: (entity: SourceEntity) => void;
  emptyLabel: string;
}) {
  const { t } = useTranslation('rfqs');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entities;
    return entities.filter((entity) => entity.name.toLowerCase().includes(query));
  }, [entities, search]);

  return (
    <div className="rounded-xl border border-border p-3 flex flex-col gap-3 min-h-0">
      <div className="flex items-center gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder={t('create.picker.search')} />
        {selectable && (
          <Button
            type="button"
            variant="outline"
            size="md"
            leftIcon={<PlusInCircleIcon className="w-4 h-4" />}
            onClick={() => onSelectAll(filtered.map((entity) => entity.id))}
            data-testid="picker-select-all"
          >
            {t('create.picker.selectAll')}
          </Button>
        )}
      </div>

      {selectable && <SelectionBarRow count={selectedIds.size} onClear={() => onSelectAll([])} />}

      <div className="overflow-y-auto max-h-[380px] space-y-2 pr-1">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">{emptyLabel}</p>
        ) : (
          filtered.map((entity) => {
            const isSelected = selectedIds.has(entity.id);
            return (
              <div
                key={entity.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border border-border px-3 py-2.5',
                  isSelected && 'bg-muted/60',
                )}
                data-testid={`picker-entity-${entity.id}`}
              >
                <ItemIcon />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{entity.name}</p>
                  {entity.description && (
                    <p className="text-xs text-muted-foreground truncate">{entity.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onDrillIn(entity)}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={t('create.picker.preview')}
                  data-testid={`picker-view-${entity.id}`}
                >
                  <EyeIcon className="w-5 h-5" />
                </button>
                {selectable ? (
                  <button
                    type="button"
                    onClick={() => onToggleEntity(entity.id, !isSelected)}
                    className={cn(
                      'p-1.5 transition-colors',
                      isSelected
                        ? 'text-foreground hover:text-destructive'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    aria-label={isSelected ? t('create.picker.deselect') : t('create.picker.select')}
                    data-testid={`picker-toggle-${entity.id}`}
                  >
                    {isSelected ? (
                      <CrossInCircleIcon className="w-5 h-5" />
                    ) : (
                      <PlusInCircleIcon className="w-5 h-5" />
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onDrillIn(entity)}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={t('create.picker.open')}
                  >
                    <PlusInCircleIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ─── Item list phase ─────────────────────────────────────────────── */

const COMMON_UOMS = ['unit', 'pcs', 'blocks', 'gallons', 'bottles', 'rolls', 'sheets', 'bags', 'm', 'kg'];

function ItemListPhase({
  entity,
  items,
  isLoading,
  picked,
  onPick,
  onUnpick,
  onPatchPicked,
  onAddAll,
  onBack,
  selectionAction,
}: {
  entity: SourceEntity;
  items: SourceItem[];
  isLoading: boolean;
  picked: Map<string, PickedSourceItem>;
  onPick: (item: SourceItem) => void;
  onUnpick: (itemId: string) => void;
  onPatchPicked: (itemId: string, patch: Partial<Pick<PickedSourceItem, 'quantity' | 'pickedUom'>>) => void;
  onAddAll: () => void;
  onBack: () => void;
  selectionAction?: ReactNode;
}) {
  const { t } = useTranslation('rfqs');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category).filter(Boolean) as string[])].sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (query && !item.name.toLowerCase().includes(query)) return false;
      if (categoryFilter && item.category !== categoryFilter) return false;
      return true;
    });
  }, [items, search, categoryFilter]);

  const pickedInEntity = [...picked.values()].filter((item) => item.entityId === entity.id).length;

  return (
    <div className="flex flex-col gap-3 min-h-0">
      {/* Back + entity name + add all */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 text-foreground hover:bg-accent rounded-lg transition-colors"
          aria-label={t('create.picker.back')}
          data-testid="picker-back"
        >
          <CaretLeftIcon className="w-5 h-5" />
        </button>
        <h3 className="flex-1 text-xl font-semibold text-foreground truncate">{entity.name}</h3>
        <Button type="button" size="lg" onClick={onAddAll} data-testid="picker-add-all-items">
          {t('create.picker.addAllItems')}
        </Button>
      </div>

      <div className="rounded-xl border border-border p-3 flex flex-col gap-3 min-h-0">
        <SelectionBarRow
          count={pickedInEntity}
          onClear={() =>
            [...picked.values()]
              .filter((item) => item.entityId === entity.id)
              .forEach((item) => onUnpick(item.id))
          }
          action={selectionAction}
        />

        <div className="flex items-center gap-3">
          <SearchBox value={search} onChange={setSearch} placeholder={t('create.picker.search')} />
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((p) => !p)}
              className={cn(
                'flex items-center gap-1.5 h-11 px-3 text-sm text-foreground border border-border rounded-lg hover:bg-accent',
                categoryFilter && 'bg-accent',
              )}
              data-testid="picker-filters"
            >
              {t('create.picker.filters')}
            </button>
            {filterOpen && (
              <div className="absolute right-0 mt-1 w-56 max-h-64 overflow-y-auto bg-background border border-border rounded-lg shadow-lg z-30 p-1">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent"
                  onClick={() => {
                    setCategoryFilter('');
                    setFilterOpen(false);
                  }}
                >
                  {t('create.vendors.allCategories')}
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent',
                      categoryFilter === category && 'bg-accent font-medium',
                    )}
                    onClick={() => {
                      setCategoryFilter(category);
                      setFilterOpen(false);
                    }}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-y-auto max-h-[330px] space-y-2 pr-1">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              {t('create.picker.noItems')}
            </p>
          ) : (
            filtered.map((item) => {
              const pickedItem = picked.get(item.id);
              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border border-border px-3 py-2.5',
                    pickedItem && 'bg-muted/60',
                  )}
                  data-testid={`picker-item-${item.id}`}
                >
                  <ItemIcon />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                      {item.category && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 bg-muted text-muted-foreground rounded shrink-0">
                          {item.category}
                        </span>
                      )}
                    </div>
                    {item.manufacturer && (
                      <p className="text-xs text-muted-foreground truncate">{item.manufacturer}</p>
                    )}
                    {item.uom && <p className="text-xs text-muted-foreground truncate">{item.uom}</p>}
                    {item.description && (
                      <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                    )}
                  </div>

                  {pickedItem ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={pickedItem.pickedUom}
                        onChange={(e) => onPatchPicked(item.id, { pickedUom: e.target.value })}
                        className="h-10 rounded-lg border border-border bg-background px-2 text-sm text-foreground focus:outline-none"
                        aria-label={t('create.picker.uom')}
                      >
                        {[pickedItem.pickedUom, ...COMMON_UOMS]
                          .filter((uom, i, arr) => arr.indexOf(uom) === i && uom)
                          .map((uom) => (
                            <option key={uom} value={uom}>
                              {uom}
                            </option>
                          ))}
                      </select>
                      <input
                        inputMode="numeric"
                        value={pickedItem.quantity || ''}
                        onChange={(e) =>
                          onPatchPicked(item.id, { quantity: parseInt(e.target.value, 10) || 0 })
                        }
                        placeholder={t('create.picker.qty')}
                        className="w-16 h-10 rounded-lg border border-border bg-background text-center text-sm focus:outline-none focus:border-foreground/40"
                        data-testid={`picker-qty-${item.id}`}
                      />
                      <button
                        type="button"
                        onClick={() => onUnpick(item.id)}
                        className="p-1.5 text-foreground hover:text-destructive transition-colors"
                        aria-label={t('create.picker.deselect')}
                      >
                        <CrossInCircleIcon className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onPick(item)}
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      aria-label={t('create.picker.select')}
                      data-testid={`picker-pick-${item.id}`}
                    >
                      <PlusInCircleIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── The modal ───────────────────────────────────────────────────── */

export interface SourcePickerModalProps {
  texts: SourceTexts;
  entities: SourceEntity[];
  entitiesLoading: boolean;
  /** Controlled drill-in: the currently open entity (null = entity list). */
  openEntity: SourceEntity | null;
  onOpenEntityChange: (entity: SourceEntity | null) => void;
  /** Items of the open entity. */
  items: SourceItem[];
  itemsLoading: boolean;
  /**
   * Convert mode — whole-entity selection + Continue. When false the modal is
   * the in-wizard "Add from …" variant (cherry-pick + Add selected / Add all).
   */
  convertMode?: boolean;
  onClose: () => void;
  /**
   * Commit handler. Receives the cherry-picked items and (convert mode) the
   * ids of fully-selected entities for the caller to expand.
   */
  onCommit: (picked: PickedSourceItem[], selectedEntityIds: string[]) => void;
  commitBusy?: boolean;
}

/**
 * Shared two-phase picker behind "Add from BOM", "Add from material list",
 * "Converting BOM" and "Create from material list" (Figma 5.05): a list of
 * source containers, drill-in to cherry-pick items (with qty/UoM), optional
 * whole-container selection in convert mode.
 */
export function SourcePickerModal({
  texts,
  entities,
  entitiesLoading,
  openEntity,
  onOpenEntityChange,
  items,
  itemsLoading,
  convertMode = false,
  onClose,
  onCommit,
  commitBusy = false,
}: SourcePickerModalProps) {
  const { t } = useTranslation('rfqs');
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Map<string, PickedSourceItem>>(new Map());

  const pickItem = (item: SourceItem) => {
    if (!openEntity) return;
    setPicked((prev) => {
      const next = new Map(prev);
      next.set(item.id, {
        ...item,
        entityId: openEntity.id,
        quantity: texts.defaultQuantity(item),
        pickedUom: item.uom ?? 'unit',
      });
      return next;
    });
  };

  const unpick = (itemId: string) => {
    setPicked((prev) => {
      const next = new Map(prev);
      next.delete(itemId);
      return next;
    });
  };

  const patchPicked = (
    itemId: string,
    patch: Partial<Pick<PickedSourceItem, 'quantity' | 'pickedUom'>>,
  ) => {
    setPicked((prev) => {
      const existing = prev.get(itemId);
      if (!existing) return prev;
      const next = new Map(prev);
      next.set(itemId, { ...existing, ...patch });
      return next;
    });
  };

  const pickAllInOpenEntity = () => {
    if (!openEntity) return;
    setPicked((prev) => {
      const next = new Map(prev);
      for (const item of items) {
        next.set(item.id, {
          ...item,
          entityId: openEntity.id,
          quantity: texts.defaultQuantity(item),
          pickedUom: item.uom ?? 'unit',
        });
      }
      return next;
    });
  };

  const commit = () => onCommit([...picked.values()], [...selectedEntityIds]);

  const totalSelected = picked.size + (convertMode ? selectedEntityIds.size : 0);

  return (
    <Modal onClose={onClose} maxWidth="max-w-[1024px] min-w-[860px]">
      <div className="p-8 flex flex-col gap-6">
        <ModalIconHeader
          icon={<PackageIcon className="w-6 h-6 text-foreground" />}
          title={texts.title}
          subtitle={texts.subtitle}
          onClose={onClose}
          className="mb-0"
        />

        {openEntity ? (
          <ItemListPhase
            entity={openEntity}
            items={items}
            isLoading={itemsLoading}
            picked={picked}
            onPick={pickItem}
            onUnpick={unpick}
            onPatchPicked={patchPicked}
            onAddAll={pickAllInOpenEntity}
            onBack={() => onOpenEntityChange(null)}
            selectionAction={
              !convertMode && (
                <Button
                  type="button"
                  size="sm"
                  onClick={commit}
                  isLoading={commitBusy}
                  data-testid="picker-add-selected"
                >
                  {t('create.picker.addSelected')}
                </Button>
              )
            }
          />
        ) : (
          <EntityListPhase
            entities={entities}
            isLoading={entitiesLoading}
            selectable={convertMode}
            selectedIds={selectedEntityIds}
            onToggleEntity={(id, selected) =>
              setSelectedEntityIds((prev) => {
                const next = new Set(prev);
                if (selected) next.add(id);
                else next.delete(id);
                return next;
              })
            }
            onSelectAll={(ids) => setSelectedEntityIds(new Set(ids))}
            onDrillIn={onOpenEntityChange}
            emptyLabel={t('create.picker.noEntities')}
          />
        )}

        {convertMode && (
          <div className="flex justify-end">
            <Button
              type="button"
              size="lg"
              onClick={commit}
              disabled={totalSelected === 0}
              isLoading={commitBusy}
              rightIcon={<span aria-hidden>→</span>}
              data-testid="picker-continue"
            >
              {t('create.picker.continue')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
