import type {
  MaterialListItemDto,
  MaterialSuggestionDto,
  ProjectListItem,
  RfqAvailabilityResult,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Button,
  DatePicker,
  DotActionsMenu,
  LineItemEditor,
  MaterialSearchPanel,
  StepperInput,
  Textarea,
  cn,
  type MaterialItem,
  todayIso,
  ScrollTable,
  useIsPhone,
  type LineItemField,
} from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import ChevronDownIcon from '@forethread/ui-components/assets/icons/chevron-down.svg?react';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import NoteIcon from '@forethread/ui-components/assets/icons/note.svg?react';
import ProjectsIcon from '@forethread/ui-components/assets/icons/projects.svg?react';
import { useMemo, useState, type ReactNode } from 'react';

import {
  buildMatchIndex,
  remainingQty,
  type AllocationMap,
  type CoverageAllocation,
  type VendorCellMatch,
} from './availability';
import { ManualMaterialNameCell } from './ManualMaterialNameCell';
import { TABLE_BODY_ROW, TABLE_HEADER_ROW, TABLE_TH } from './tableStyles';
import { nextLineKey, type WizardLineItem } from './wizard-types';

interface StepLineItemsProps {
  items: WizardLineItem[];
  onItemsChange: (items: WizardLineItem[]) => void;
  /** Wizard-selected projects, in selection order (groups render in this order). */
  projects: ProjectListItem[];
  /** Catalogue search results for the toolbar search popup. */
  materials: MaterialListItemDto[];
  materialsCount?: number;
  search: string;
  onSearchChange: (value: string) => void;
  onOpenAddFromBom: () => void;
  onOpenAddFromMaterialList: () => void;
  /** Footer action inside the search popup ("add to the directory" annotation). */
  onCreateMaterial?: () => void;
  error?: string;
  // ── Inline bulk-order availability (merged Check-Availability step) ──
  /** Run the availability check (persists the draft, fetches bulk-order matches). */
  onCheckAvailability: () => void;
  /** Bulk-order availability result; undefined until the check has been run. */
  availability?: RfqAvailabilityResult;
  /** True once a check has been requested (drives the Availability column). */
  availabilityChecked: boolean;
  availabilityLoading: boolean;
  allocations: AllocationMap;
  onAllocationsChange: (allocations: AllocationMap) => void;
}

/** Trailing group id for line items not matched to any selected project. */
const UNASSIGNED_GROUP_ID = '__unassigned__';

/** Per-project inline manual entry draft. `materialId` is set when the name
 * was picked from the catalogue popup (FOR-274) and dropped again as soon as
 * the user edits the name to free text. `description` has no cell of its own —
 * it only carries the catalogue material's description onto the line. */
interface ManualDraft {
  name: string;
  description: string;
  quantity: string;
  uom: string;
  materialId?: string;
}

const EMPTY_MANUAL_DRAFT: ManualDraft = { name: '', description: '', quantity: '', uom: '' };

/** A line plus its position in `items` (bulk-order matches are keyed by it). */
interface LineRow {
  item: WizardLineItem;
  index: number;
}

/** Field keys the desktop row renders from the shared field definitions. */
type LineFieldKey = 'name' | 'qty' | 'uom' | 'delivery' | 'availability' | 'project' | 'notes';

/** Borderless table-cell input vs the bordered, 16px input in the phone sheet. */
const CELL_INPUT_CLASS =
  'w-full h-9 px-2 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:bg-muted/40 rounded';
const SHEET_INPUT_CLASS =
  'w-full h-11 px-3 rounded-xl border border-border bg-background text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-gray-300';

/** A line can be saved once it has a name, a unit and a positive quantity. */
function isLineComplete(item: WizardLineItem): boolean {
  return item.materialName.trim() !== '' && item.uom.trim() !== '' && item.quantity >= 0.01;
}

function formatExpiration(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Consolidated step 1 — "Add Line Items" (Figma 5.05): catalogue search popup,
 * Add-from-BOM / Add-from-material-list entry points, and the per-project
 * grouped editable table with an inline manual row per project group and
 * expandable notes. The Check-Availability step is folded in here as a single
 * persistent "Availability" column: each row can be checked against active bulk
 * orders and covered inline before the RFQ is sent.
 */
export function StepLineItems({
  items,
  onItemsChange,
  projects,
  materials,
  materialsCount,
  search,
  onSearchChange,
  onOpenAddFromBom,
  onOpenAddFromMaterialList,
  onCreateMaterial,
  error,
  onCheckAvailability,
  availability,
  availabilityChecked,
  availabilityLoading,
  allocations,
  onAllocationsChange,
}: StepLineItemsProps) {
  const { t } = useTranslation('rfqs');
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [notesOpen, setNotesOpen] = useState<Record<string, boolean>>({});
  /** Per-project inline manual entry drafts. */
  const [manualDrafts, setManualDrafts] = useState<Record<string, ManualDraft>>({});
  const isPhone = useIsPhone();
  /** Phone sheet: lines that failed Save because a required field is empty. */
  const [invalidKeys, setInvalidKeys] = useState<Set<string>>(new Set());

  const defaultProjectId = projects[0]?.id;

  const matchIndex = useMemo(() => buildMatchIndex(availability), [availability]);
  const vendors = availability?.vendors ?? [];

  const searchResults = useMemo<MaterialItem[]>(
    () =>
      materials.map((material) => ({
        id: material.id,
        name: material.name,
        category: material.categoryName ?? undefined,
        unit: material.unitOfMeasure,
        description: material.description ?? undefined,
      })),
    [materials],
  );

  const updateItem = (key: string, patch: Partial<WizardLineItem>) => {
    onItemsChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const removeItem = (key: string) => {
    onItemsChange(items.filter((item) => item.key !== key));
  };

  const addCatalogueItem = (material: MaterialItem) => {
    onItemsChange([
      ...items,
      {
        key: nextLineKey(),
        source: 'CATALOG',
        materialId: material.id,
        materialName: material.name,
        description: material.description,
        quantity: 1,
        uom: material.unit ?? 'unit',
        projectId: defaultProjectId,
      },
    ]);
    setSearchOpen(false);
    onSearchChange('');
  };

  const manualDraftFor = (projectId: string) => manualDrafts[projectId] ?? EMPTY_MANUAL_DRAFT;

  const patchManualDraft = (projectId: string, patch: Partial<ManualDraft>) => {
    setManualDrafts((prev) => ({
      ...prev,
      [projectId]: { ...manualDraftFor(projectId), ...patch },
    }));
  };

  /** Fill the manual draft from a catalogue pick (FOR-274): the name is linked
   * to the material, and UoM / description prefill only when still empty. */
  const selectManualMaterial = (projectId: string, material: MaterialSuggestionDto) => {
    const draft = manualDraftFor(projectId);
    patchManualDraft(projectId, {
      name: material.name,
      materialId: material.id,
      uom: draft.uom.trim() ? draft.uom : (material.uom ?? ''),
      description: draft.description.trim() ? draft.description : (material.description ?? ''),
    });
  };

  /** Promote a complete manual draft into a real line item. */
  const commitManualDraft = (projectId: string) => {
    const draft = manualDraftFor(projectId);
    const quantity = Number(draft.quantity);
    if (!draft.name.trim() || !draft.uom.trim() || Number.isNaN(quantity) || quantity < 0.01) {
      return;
    }
    onItemsChange([
      ...items,
      {
        key: nextLineKey(),
        source: 'CATALOG',
        materialId: draft.materialId,
        materialName: draft.name.trim(),
        description: draft.description.trim() || undefined,
        quantity,
        uom: draft.uom.trim(),
        projectId,
      },
    ]);
    setManualDrafts((prev) => ({ ...prev, [projectId]: EMPTY_MANUAL_DRAFT }));
  };

  // ── Coverage allocation helpers (merged from the Check-Availability step) ──
  const setAllocation = (
    lineKey: string,
    vendorId: string,
    allocation: CoverageAllocation | null,
  ) => {
    const next: AllocationMap = new Map(
      [...allocations.entries()].map(([key, value]) => [key, new Map(value)]),
    );
    let byVendor = next.get(lineKey);
    if (!byVendor) {
      byVendor = new Map();
      next.set(lineKey, byVendor);
    }
    if (allocation) byVendor.set(vendorId, allocation);
    else byVendor.delete(vendorId);
    onAllocationsChange(next);
  };

  /** Cover the line's remaining quantity from the vendor with the most spare
   * bulk-order capacity. Repeatable: each call tops up the best vendor, so a
   * line that spans several bulk orders can be filled with successive clicks. */
  const coverBest = (item: WizardLineItem, itemIndex: number) => {
    const remaining = remainingQty(item, allocations);
    if (remaining <= 0) return;
    const byVendor = matchIndex.get(itemIndex);
    if (!byVendor) return;
    let best:
      | { vendorId: string; match: VendorCellMatch; spare: number; allocated: number }
      | undefined;
    for (const [vendorId, match] of byVendor) {
      const allocated = allocations.get(item.key)?.get(vendorId)?.quantity ?? 0;
      const spare = match.qtyRemaining - allocated;
      if (spare > 0 && (!best || spare > best.spare)) {
        best = { vendorId, match, spare, allocated };
      }
    }
    if (!best) return;
    const add = Math.min(best.spare, remaining);
    setAllocation(item.key, best.vendorId, {
      lineKey: item.key,
      vendorId: best.vendorId,
      bulkOrderLineItemId: best.match.bulkOrderLineItemId,
      quantity: best.allocated + add,
    });
  };

  /** Drop every bulk-order allocation on a line (the Availability "Cancel"). */
  const clearRowAllocations = (lineKey: string) => {
    if (!allocations.has(lineKey)) return;
    const next: AllocationMap = new Map(
      [...allocations.entries()].map(([key, value]) => [key, new Map(value)]),
    );
    next.delete(lineKey);
    onAllocationsChange(next);
  };

  const totalQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  /** Groups follow the wizard's project selection; rows with no project yet go
   * under the first group. Rows whose project isn't among the selected ones —
   * including everything added before a project was picked — fall into a
   * trailing "Unassigned" group so added items are never silently hidden. */
  const grouped = useMemo(() => {
    const groups = projects.map((project) => ({
      id: project.id,
      name: project.name,
      isUnassigned: false,
      rows: items
        .map((item, index) => ({ item, index }))
        .filter(
          ({ item }) =>
            item.projectId === project.id || (!item.projectId && project.id === defaultProjectId),
        ),
    }));
    const placed = new Set(groups.flatMap((group) => group.rows.map((row) => row.index)));
    const orphans = items
      .map((item, index) => ({ item, index }))
      .filter(({ index }) => !placed.has(index));
    if (orphans.length > 0) {
      groups.push({
        id: UNASSIGNED_GROUP_ID,
        name: t('create.lineItems.unassignedGroup'),
        isUnassigned: true,
        rows: orphans,
      });
    }
    return groups;
  }, [projects, items, defaultProjectId, t]);

  const projectOptions = projects.map((project) => ({ value: project.id, label: project.name }));

  /** Columns: material, qty, uom, exp, availability, actions. The project is
   * carried by the group header, so rows don't repeat it (6 columns total). */
  const colCount = 6;

  const canCheckAvailability = items.length > 0 && !availabilityLoading;

  const availabilityLabels = {
    check: t('create.availability.check'),
    checking: t('create.availability.cellChecking'),
    none: t('create.availability.cellNone'),
    available: t('create.availability.available'),
    covered: t('create.availability.covered'),
    cover: t('create.availability.cover'),
    cancel: t('create.availability.cancel'),
  };

  // ── Line fields, defined once (ADR-0019 B10): the desktop row renders these
  // inputs in its cells; on phones LineItemEditor stacks them in the sheet.
  const inputClass = isPhone ? SHEET_INPUT_CLASS : CELL_INPUT_CLASS;
  const lineFields: Array<LineItemField<LineRow> & { key: LineFieldKey }> = [
    {
      key: 'name',
      label: t('create.lineItems.colMaterialName'),
      required: true,
      // Catalogue / BOM lines keep their name. A line added on a phone types it,
      // with the same catalogue autocomplete as the desktop manual row.
      input: ({ item }) =>
        !isPhone || item.materialId || item.source !== 'CATALOG' ? (
          <span className="text-foreground">{item.materialName}</span>
        ) : (
          <div className="rounded-xl border border-border bg-background [&_input]:h-11 [&_input]:text-base">
            <ManualMaterialNameCell
              value={item.materialName}
              onValueChange={(name) => updateItem(item.key, { materialName: name })}
              onSelectMaterial={(material) =>
                updateItem(item.key, {
                  materialName: material.name,
                  materialId: material.id,
                  uom: item.uom.trim() ? item.uom : (material.uom ?? ''),
                  description: item.description ?? material.description ?? undefined,
                })
              }
              onCommit={() => undefined}
              placeholder={t('create.lineItems.manualNamePlaceholder')}
              testId={`line-name-${item.key}`}
            />
          </div>
        ),
      hint: ({ item }) =>
        invalidKeys.has(item.key) && !isLineComplete(item) ? (
          <p className="text-xs text-destructive">
            {t('create.lineItems.lineIncomplete', {
              defaultValue: 'Add a name, a quantity and a unit to save this line.',
            })}
          </p>
        ) : null,
    },
    {
      key: 'qty',
      label: t('create.lineItems.colQty'),
      required: true,
      value: ({ item }) => item.quantity,
      input: ({ item }) => (
        <StepperInput
          value={String(item.quantity || '')}
          onValueChange={(value) => updateItem(item.key, { quantity: Number(value) || 0 })}
          min={0}
          data-testid={`line-qty-${item.key}`}
        />
      ),
    },
    {
      key: 'uom',
      label: t('create.lineItems.colUom'),
      required: true,
      value: ({ item }) => item.uom || '-',
      input: ({ item }) => (
        <input
          value={item.uom}
          onChange={(e) => updateItem(item.key, { uom: e.target.value })}
          placeholder={isPhone ? t('create.lineItems.manualUomPlaceholder') : undefined}
          className={inputClass}
          data-testid={`line-uom-${item.key}`}
        />
      ),
    },
    {
      key: 'delivery',
      label: t('create.lineItems.colExpDelivery'),
      value: ({ item }) => item.expectedDeliveryDate ?? '-',
      input: ({ item }) => (
        <DatePicker
          value={item.expectedDeliveryDate ?? ''}
          onChange={(date) => updateItem(item.key, { expectedDeliveryDate: date || undefined })}
          placeholder="mm/dd/yyyy"
          minDate={todayIso()}
          borderless={!isPhone}
          editable
        />
      ),
    },
    {
      key: 'availability',
      label: t('create.lineItems.colAvailability'),
      input: ({ item, index }) => (
        <AvailabilityCell
          itemIndex={index}
          vendors={vendors}
          matchIndex={matchIndex}
          rowAllocations={allocations.get(item.key)}
          remaining={remainingQty(item, allocations)}
          availabilityChecked={availabilityChecked}
          availabilityLoading={availabilityLoading}
          onRequestCheck={onCheckAvailability}
          onCoverBest={() => coverBest(item, index)}
          onClearRow={() => clearRowAllocations(item.key)}
          labels={availabilityLabels}
        />
      ),
    },
    {
      // Phones only: desktop moves rows from the actions-column menu.
      key: 'project',
      label: t('create.lineItems.moveToProject'),
      hidden: () => projectOptions.length < 2,
      input: ({ item }) => (
        <select
          value={item.projectId ?? defaultProjectId ?? ''}
          onChange={(e) => updateItem(item.key, { projectId: e.target.value })}
          className={SHEET_INPUT_CLASS}
          data-testid={`line-project-${item.key}`}
        >
          {projectOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'notes',
      label: (
        <>
          {t('create.lineItems.additionalNotes')}{' '}
          <span className="text-muted-foreground font-normal">({t('create.optional')})</span>
        </>
      ),
      input: ({ item }) => (
        <Textarea
          rows={2}
          value={item.notes ?? ''}
          onChange={(e) => updateItem(item.key, { notes: e.target.value || undefined })}
          placeholder={t('create.lineItems.notesPlaceholder')}
          data-testid={`line-notes-${item.key}`}
        />
      ),
    },
  ];
  const renderField = (key: LineFieldKey, row: LineRow): ReactNode =>
    lineFields.find((field) => field.key === key)?.input(row, row.index) ?? null;

  /** Phone sheet Save / Previous / Next: block leaving an incomplete line. */
  const validatePhoneLine = (rows: LineRow[]) => (i: number) => {
    const row = rows[i];
    if (!row || isLineComplete(row.item)) return true;
    setInvalidKeys((prev) => new Set(prev).add(row.item.key));
    return false;
  };

  /** Phone "Add line" in a project group: a blank manual line, opened in the sheet. */
  const addPhoneLine = (groupId: string, rowCount: number) => {
    onItemsChange([
      ...items,
      {
        key: nextLineKey(),
        source: 'CATALOG',
        materialName: '',
        quantity: 1,
        uom: '',
        projectId: groupId,
      },
    ]);
    return rowCount;
  };

  return (
    <div className="space-y-4">
      {/* ── Toolbar: catalogue search + add-from / check-availability buttons ── */}
      <div className="flex flex-col sm:flex-row items-stretch gap-3">
        <div className="flex-1 min-w-0">
          <MaterialSearchPanel
            search={search}
            onSearchChange={onSearchChange}
            results={searchResults}
            resultsCount={materialsCount}
            selected={[]}
            onSelect={addCatalogueItem}
            onDeselect={() => undefined}
            onQuantityChange={() => undefined}
            onAddToList={() => undefined}
            open={searchOpen}
            onOpenChange={setSearchOpen}
            searchPlaceholder={t('create.lineItems.searchPlaceholder')}
            resultsLabel={t('create.lineItems.results')}
            filtersLabel={t('create.lineItems.filters')}
            footerAction={
              onCreateMaterial && (
                <Button type="button" variant="ghost" size="sm" onClick={onCreateMaterial}>
                  {t('create.lineItems.addToDirectory')}
                </Button>
              )
            }
          />
        </div>
        <div className="flex items-start gap-3 shrink-0">
          <Button type="button" size="lg" onClick={onOpenAddFromBom} data-testid="add-from-bom">
            {t('create.lineItems.addFromBom')}
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={onOpenAddFromMaterialList}
            data-testid="add-from-material-list"
          >
            {t('create.lineItems.addFromMaterialList')}
          </Button>
        </div>
      </div>

      {/* ── Check availability (folds the former Check-Availability step in) ── */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">{t('create.lineItems.availabilityHint')}</p>
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={onCheckAvailability}
          disabled={!canCheckAvailability}
          isLoading={availabilityLoading}
          leftIcon={<CheckCircleIcon className="w-4 h-4" />}
          data-testid="check-availability"
        >
          {availabilityChecked
            ? t('create.lineItems.recheckAvailability')
            : t('create.footer.checkAvailability')}
        </Button>
      </div>

      {/* ── Phones: one card list per project group + the line edit sheet (B10) ── */}
      {isPhone && (
        <div className="flex flex-col gap-4" data-testid="line-items-cards">
          {grouped.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('create.lineItems.unassignedHint')}</p>
          )}
          {grouped.map(({ id: groupId, name: groupName, isUnassigned, rows }) => (
            <section key={groupId} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {groupName}
                {isUnassigned && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {t('create.lineItems.unassignedHint')}
                  </span>
                )}
              </h3>
              <LineItemEditor
                lines={rows}
                fields={lineFields}
                getKey={({ item }) => item.key}
                getTitle={({ item }) =>
                  item.materialName || t('create.lineItems.manualNamePlaceholder')
                }
                validateLine={validatePhoneLine(rows)}
                hasError={({ item }) => invalidKeys.has(item.key) && !isLineComplete(item)}
                onRemove={(i) => {
                  const row = rows[i];
                  if (row) removeItem(row.item.key);
                }}
                removeLabel={t('create.lineItems.removeLine', { defaultValue: 'Remove line' })}
                // Manual lines need a project, so the catch-all group gets no Add.
                onAdd={isUnassigned ? undefined : () => addPhoneLine(groupId, rows.length)}
                addLabel={t('create.lineItems.addLine', { defaultValue: 'Add line' })}
              />
            </section>
          ))}
          <div className="flex items-center gap-6 text-sm">
            <span className="text-muted-foreground">
              {t('create.lineItems.totalItems')}{' '}
              <span className="font-semibold text-foreground" data-testid="total-items">
                {items.length}
              </span>
            </span>
            <span className="text-muted-foreground">
              {t('create.lineItems.totalQty')}{' '}
              <span className="font-semibold text-foreground" data-testid="total-qty">
                {totalQty}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* ── Grouped line-items table ── */}
      {!isPhone && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <ScrollTable>
            <table className={cn('w-full text-sm min-w-[900px]')} data-testid="line-items-table">
              <thead>
                <tr className={TABLE_HEADER_ROW}>
                  <th className={TABLE_TH}>{t('create.lineItems.colMaterialName')}</th>
                  <th className={cn(TABLE_TH, 'w-[120px]')}>
                    {t('create.lineItems.colQty')} <span className="text-destructive">*</span>
                  </th>
                  <th className={cn(TABLE_TH, 'w-[140px]')}>
                    {t('create.lineItems.colUom')} <span className="text-destructive">*</span>
                  </th>
                  <th className={cn(TABLE_TH, 'w-[150px]')}>
                    {t('create.lineItems.colExpDelivery')}
                  </th>
                  <th className={cn(TABLE_TH, 'w-[210px]')}>
                    {t('create.lineItems.colAvailability')}
                  </th>
                  <th className={cn(TABLE_TH, 'w-[120px]')}>{t('create.lineItems.colActions')}</th>
                </tr>
              </thead>

              {grouped.map((group) => {
                const { id: groupId, name: groupName, isUnassigned, rows } = group;
                const isCollapsed = collapsed[groupId] ?? false;
                const draft = manualDraftFor(groupId);
                return (
                  <tbody key={groupId} data-testid={`project-group-${groupId}`}>
                    {/* Group header */}
                    <tr className="bg-[color:color-mix(in_srgb,hsl(var(--muted))_60%,hsl(var(--card)))]">
                      <td colSpan={colCount} className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="flex items-center gap-2 text-sm text-foreground"
                            onClick={() =>
                              setCollapsed((prev) => ({ ...prev, [groupId]: !isCollapsed }))
                            }
                          >
                            {isCollapsed ? (
                              <ChevronRightIcon className="w-4 h-4" />
                            ) : (
                              <ChevronDownIcon className="w-4 h-4" />
                            )}
                            {groupName}
                          </button>
                          {isUnassigned && (
                            <span className="text-xs font-normal text-muted-foreground">
                              {t('create.lineItems.unassignedHint')}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>

                    {!isCollapsed &&
                      rows.map(({ item, index }) => (
                        <LineItemRow
                          key={item.key}
                          row={{ item, index }}
                          renderField={renderField}
                          projectOptions={projectOptions}
                          groupProjectId={groupId}
                          moveLabel={t('create.lineItems.moveToProject')}
                          notesOpen={notesOpen[item.key] ?? false}
                          onToggleNotes={() =>
                            setNotesOpen((prev) => ({
                              ...prev,
                              [item.key]: !(prev[item.key] ?? false),
                            }))
                          }
                          onMove={(projectId) => updateItem(item.key, { projectId })}
                          onRemove={() => removeItem(item.key)}
                          notesLabel={t('create.lineItems.additionalNotes')}
                          notesOptionalLabel={t('create.optional')}
                          colCount={colCount}
                        />
                      ))}

                    {/* Inline manual entry row (design: empty editable row per group).
                      Suppressed for the catch-all group — manual rows need a project. */}
                    {!isCollapsed && !isUnassigned && (
                      <tr className={TABLE_BODY_ROW} data-testid={`manual-row-${groupId}`}>
                        <td className="py-1.5 px-1">
                          <ManualMaterialNameCell
                            value={draft.name}
                            onValueChange={(name) =>
                              patchManualDraft(groupId, { name, materialId: undefined })
                            }
                            onSelectMaterial={(material) => selectManualMaterial(groupId, material)}
                            onCommit={() => commitManualDraft(groupId)}
                            placeholder={t('create.lineItems.manualNamePlaceholder')}
                            testId={`manual-name-${groupId}`}
                          />
                        </td>
                        <td className="py-1.5 px-1">
                          <StepperInput
                            value={draft.quantity}
                            onValueChange={(value) =>
                              patchManualDraft(groupId, { quantity: value })
                            }
                            onBlur={() => commitManualDraft(groupId)}
                            min={0}
                            placeholder="0"
                            data-testid={`manual-qty-${groupId}`}
                          />
                        </td>
                        <td className="py-1.5 px-1">
                          <input
                            value={draft.uom}
                            onChange={(e) => patchManualDraft(groupId, { uom: e.target.value })}
                            onBlur={() => commitManualDraft(groupId)}
                            placeholder={t('create.lineItems.manualUomPlaceholder')}
                            className="w-full h-9 px-2 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:bg-muted/40 rounded"
                            data-testid={`manual-uom-${groupId}`}
                          />
                        </td>
                        <td className="py-1.5 px-1 text-muted-foreground" colSpan={colCount - 3} />
                      </tr>
                    )}
                  </tbody>
                );
              })}
            </table>
          </ScrollTable>

          {/* Totals footer */}
          <div className="flex items-center gap-8 border-t border-border px-4 py-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{t('create.lineItems.totalItems')}</span>
              <span className="font-semibold text-foreground" data-testid="total-items">
                {items.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{t('create.lineItems.totalQty')}</span>
              <span className="font-semibold text-foreground" data-testid="total-qty">
                {totalQty}
              </span>
            </div>
          </div>
        </div>
      )}

      {availabilityChecked && !availabilityLoading && vendors.length === 0 && (
        <p className="text-xs text-muted-foreground" data-testid="no-coverage">
          {t('create.availability.noCoverage')}
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface AvailabilityLabels {
  check: string;
  checking: string;
  none: string;
  available: string;
  covered: string;
  cover: string;
  cancel: string;
}

interface AvailabilityCellProps {
  itemIndex: number;
  vendors: Array<{ vendorId: string; vendorName: string }>;
  matchIndex: Map<number, Map<string, VendorCellMatch>>;
  rowAllocations: Map<string, CoverageAllocation> | undefined;
  remaining: number;
  availabilityChecked: boolean;
  availabilityLoading: boolean;
  onRequestCheck: () => void;
  onCoverBest: () => void;
  onClearRow: () => void;
  labels: AvailabilityLabels;
}

/** Per-line bulk-order coverage: the table's Availability cell and the phone sheet field. */
function AvailabilityCell({
  itemIndex,
  vendors,
  matchIndex,
  rowAllocations,
  remaining,
  availabilityChecked,
  availabilityLoading,
  onRequestCheck,
  onCoverBest,
  onClearRow,
  labels: availabilityLabels,
}: AvailabilityCellProps) {
  // Per-row bulk-order coverage summary, collapsed into the single Availability
  // column: the best (largest) vendor match drives the headline, the rest add up
  // into the total available quantity.
  const rowMatches = vendors.flatMap((vendor) => {
    const match = matchIndex.get(itemIndex)?.get(vendor.vendorId);
    return match && match.qtyRemaining > 0 ? [{ vendor, match }] : [];
  });
  const bestMatch = [...rowMatches].sort((a, b) => b.match.qtyRemaining - a.match.qtyRemaining)[0];
  const totalAvailable = rowMatches.reduce((sum, m) => sum + m.match.qtyRemaining, 0);
  const coveredQty = rowAllocations
    ? [...rowAllocations.values()].reduce((sum, a) => sum + a.quantity, 0)
    : 0;
  // Spare = vendor capacity not yet allocated; gates the "cover the rest" action
  // so it never shows on a line already filled to the bulk orders' limit.
  const hasSpareCapacity = rowMatches.some(
    (m) => m.match.qtyRemaining - (rowAllocations?.get(m.vendor.vendorId)?.quantity ?? 0) > 0,
  );
  const canCoverMore = remaining > 0 && hasSpareCapacity;

  if (!availabilityChecked) {
    return (
      <button
        type="button"
        onClick={onRequestCheck}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-foreground border border-border rounded-full hover:bg-accent transition-colors"
        data-testid={`row-check-${itemIndex}`}
      >
        <CheckCircleIcon className="w-3.5 h-3.5" />
        {availabilityLabels.check}
      </button>
    );
  }
  if (availabilityLoading) {
    return <span className="text-xs text-muted-foreground">{availabilityLabels.checking}</span>;
  }
  if (coveredQty > 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#D6F5DE] px-2.5 py-1 text-xs font-medium text-foreground">
          <CheckCircleIcon className="w-3.5 h-3.5" />
          {coveredQty} {availabilityLabels.covered}
        </span>
        {canCoverMore && (
          <button
            type="button"
            onClick={onCoverBest}
            className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
            data-testid={`row-cover-${itemIndex}`}
          >
            {availabilityLabels.cover} {remaining}
          </button>
        )}
        <button
          type="button"
          onClick={onClearRow}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-foreground bg-background border border-border rounded-full hover:bg-accent transition-colors"
          data-testid={`row-cancel-${itemIndex}`}
        >
          {availabilityLabels.cancel}
          <CrossIcon className="w-2.5 h-2.5" />
        </button>
      </div>
    );
  }
  if (bestMatch) {
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-foreground whitespace-nowrap">
            {totalAvailable} {availabilityLabels.available}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {bestMatch.vendor.vendorName}
            {bestMatch.match.expirationDate
              ? ` · ${formatExpiration(bestMatch.match.expirationDate)}`
              : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={onCoverBest}
          disabled={remaining <= 0}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-foreground border border-border rounded-full transition-colors shrink-0',
            remaining <= 0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-accent',
          )}
          data-testid={`row-cover-${itemIndex}`}
        >
          {availabilityLabels.cover}
          <CheckCircleIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }
  return <span className="text-xs text-muted-foreground">{availabilityLabels.none}</span>;
}

interface LineItemRowProps {
  row: LineRow;
  /** Renders one of the shared line fields (the same inputs the phone sheet uses). */
  renderField: (key: LineFieldKey, row: LineRow) => ReactNode;
  projectOptions: Array<{ value: string; label: string }>;
  /** Id of the group the row is rendered under — excluded from the move menu. */
  groupProjectId: string;
  moveLabel: string;
  notesOpen: boolean;
  onToggleNotes: () => void;
  onMove: (projectId: string) => void;
  onRemove: () => void;
  notesLabel: string;
  notesOptionalLabel: string;
  colCount: number;
}

function LineItemRow({
  row,
  renderField,
  projectOptions,
  groupProjectId,
  moveLabel,
  notesOpen,
  onToggleNotes,
  onMove,
  onRemove,
  notesLabel,
  notesOptionalLabel,
  colCount,
}: LineItemRowProps) {
  const { item, index: itemIndex } = row;
  // Reassignment lives in the row actions now that the Project column is gone:
  // every selected project except the group this row already sits under. Rows in
  // the "Unassigned" group match no group id, so they get the full list.
  const moveTargets = projectOptions.filter((option) => option.value !== groupProjectId);

  return (
    <>
      <tr className={TABLE_BODY_ROW} data-testid={`line-item-${item.key}`}>
        <td className="py-1.5 px-3">{renderField('name', row)}</td>
        <td className="py-1.5 px-1">{renderField('qty', row)}</td>
        <td className="py-1.5 px-1">{renderField('uom', row)}</td>
        <td className="py-1.5 px-1">{renderField('delivery', row)}</td>

        {/* ── Availability (always-present bulk-order coverage column) ── */}
        <td className="py-1.5 px-3" data-testid={`availability-${itemIndex}`}>
          {renderField('availability', row)}
        </td>

        <td className="py-1.5 px-3">
          <div className="flex items-center gap-1">
            {moveTargets.length > 0 && (
              <DotActionsMenu
                actions={moveTargets.map((option) => ({
                  key: option.value,
                  label: option.label,
                  onClick: () => onMove(option.value),
                }))}
                bordered={false}
                ariaLabel={moveLabel}
                trigger={<ProjectsIcon className="w-4 h-4" />}
                triggerClassName="p-1.5 border-0 rounded-md"
                className="shrink-0"
              />
            )}
            <button
              type="button"
              onClick={onToggleNotes}
              className={cn(
                'relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
                notesOpen && 'text-foreground bg-accent',
              )}
              aria-label={notesLabel}
              data-testid={`line-notes-toggle-${item.key}`}
            >
              <NoteIcon className="w-4 h-4" />
              {item.notes && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-destructive" />
              )}
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
              aria-label="Remove"
              data-testid={`line-remove-${item.key}`}
            >
              <DeleteIcon className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>

      {/* Expandable notes row (design: "RFQ manually-add note") */}
      {notesOpen && (
        <tr className="border-t border-border bg-[color:color-mix(in_srgb,hsl(var(--muted))_20%,hsl(var(--card)))]">
          <td colSpan={colCount} className="py-3 px-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                {notesLabel}{' '}
                <span className="text-muted-foreground font-normal">({notesOptionalLabel})</span>
              </span>
              {renderField('notes', row)}
            </label>
          </td>
        </tr>
      )}
    </>
  );
}
