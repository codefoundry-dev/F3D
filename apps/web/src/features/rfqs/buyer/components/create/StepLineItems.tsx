import type { MaterialListItemDto, ProjectListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Button,
  DatePicker,
  MaterialSearchPanel,
  StepperInput,
  Textarea,
  cn,
  type MaterialItem,
} from '@forethread/ui-components';
import ChevronDownIcon from '@forethread/ui-components/assets/icons/chevron-down.svg?react';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import NoteIcon from '@forethread/ui-components/assets/icons/note.svg?react';
import { useMemo, useState } from 'react';

import type { DeliveryLocationOption } from './StepBasicInfo';
import { TABLE_BODY_ROW, TABLE_HEADER_ROW, TABLE_TH } from './tableStyles';
import { nextLineKey, type WizardLineItem } from './wizard-types';

interface StepLineItemsProps {
  items: WizardLineItem[];
  onItemsChange: (items: WizardLineItem[]) => void;
  /** Wizard-selected projects, in selection order (groups render in this order). */
  projects: ProjectListItem[];
  locationOptions: DeliveryLocationOption[];
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
}

/** Inline select rendered borderless inside a table cell. */
function CellSelect({
  value,
  options,
  placeholder,
  onChange,
  testId,
}: {
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  onChange: (value: string) => void;
  testId?: string;
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testId}
      className={cn(
        'w-full h-9 bg-transparent text-sm text-foreground focus:outline-none cursor-pointer truncate',
        !value && 'text-muted-foreground',
      )}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Step 2 — "Add Line Items" (Figma 5.05): catalogue search popup, Add-from-BOM /
 * Add-from-material-list entry points, and the per-project grouped editable
 * table with an inline manual row per project group, expandable notes, and the
 * Total Items / Total Qty footer.
 */
export function StepLineItems({
  items,
  onItemsChange,
  projects,
  locationOptions,
  materials,
  materialsCount,
  search,
  onSearchChange,
  onOpenAddFromBom,
  onOpenAddFromMaterialList,
  onCreateMaterial,
  error,
}: StepLineItemsProps) {
  const { t } = useTranslation('rfqs');
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [notesOpen, setNotesOpen] = useState<Record<string, boolean>>({});
  /** Per-project inline manual entry drafts. */
  const [manualDrafts, setManualDrafts] = useState<
    Record<string, { name: string; description: string; quantity: string; uom: string }>
  >({});

  const defaultProjectId = projects[0]?.id;

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

  const locationsForProject = (projectId: string | undefined) =>
    locationOptions
      .filter((location) => !projectId || location.projectId === projectId)
      .map((location) => ({ value: location.id, label: location.label }));

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

  const manualDraftFor = (projectId: string) =>
    manualDrafts[projectId] ?? { name: '', description: '', quantity: '', uom: '' };

  const patchManualDraft = (
    projectId: string,
    patch: Partial<{ name: string; description: string; quantity: string; uom: string }>,
  ) => {
    setManualDrafts((prev) => ({
      ...prev,
      [projectId]: { ...manualDraftFor(projectId), ...patch },
    }));
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
        materialName: draft.name.trim(),
        description: draft.description.trim() || undefined,
        quantity,
        uom: draft.uom.trim(),
        projectId,
      },
    ]);
    setManualDrafts((prev) => ({
      ...prev,
      [projectId]: { name: '', description: '', quantity: '', uom: '' },
    }));
  };

  const totalQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  /** Groups follow the wizard's project selection; rows with no project yet go
   * under the first group. */
  const grouped = useMemo(() => {
    const groups = projects.map((project) => ({
      project,
      rows: items.filter(
        (item) =>
          item.projectId === project.id || (!item.projectId && project.id === defaultProjectId),
      ),
    }));
    return groups;
  }, [projects, items, defaultProjectId]);

  const projectOptions = projects.map((project) => ({ value: project.id, label: project.name }));

  const lineItemDisplayId = (item: WizardLineItem) =>
    item.serverId ? item.serverId.slice(0, 8).toUpperCase() : '—';

  const colCount = 9;

  return (
    <div className="space-y-4">
      {/* ── Toolbar: catalogue search + add-from buttons ── */}
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

      {/* ── Grouped line-items table ── */}
      <div className="rounded-lg border border-border overflow-x-auto bg-card">
        <table className="w-full text-sm min-w-[1100px]" data-testid="line-items-table">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <th className={cn(TABLE_TH, 'w-[140px]')}>{t('create.lineItems.colProject')}</th>
              <th className={cn(TABLE_TH, 'w-[110px]')}>{t('create.lineItems.colLineItemId')}</th>
              <th className={TABLE_TH}>{t('create.lineItems.colMaterialName')}</th>
              <th className={TABLE_TH}>{t('create.lineItems.colDescription')}</th>
              <th className={cn(TABLE_TH, 'w-[120px]')}>
                {t('create.lineItems.colQty')} <span className="text-destructive">*</span>
              </th>
              <th className={cn(TABLE_TH, 'w-[140px]')}>
                {t('create.lineItems.colUom')} <span className="text-destructive">*</span>
              </th>
              <th className={cn(TABLE_TH, 'w-[150px]')}>{t('create.lineItems.colExpDelivery')}</th>
              <th className={cn(TABLE_TH, 'w-[160px]')}>
                {t('create.lineItems.colDeliveryLocation')}
              </th>
              <th className={cn(TABLE_TH, 'w-[90px]')}>{t('create.lineItems.colActions')}</th>
            </tr>
          </thead>

          {grouped.map(({ project, rows }) => {
            const isCollapsed = collapsed[project.id] ?? false;
            const draft = manualDraftFor(project.id);
            return (
              <tbody key={project.id} data-testid={`project-group-${project.id}`}>
                {/* Group header */}
                <tr className="bg-muted/60">
                  <td colSpan={colCount} className="py-2 px-3">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-sm text-foreground"
                      onClick={() =>
                        setCollapsed((prev) => ({ ...prev, [project.id]: !isCollapsed }))
                      }
                    >
                      {isCollapsed ? (
                        <ChevronRightIcon className="w-4 h-4" />
                      ) : (
                        <ChevronDownIcon className="w-4 h-4" />
                      )}
                      {project.name}
                    </button>
                  </td>
                </tr>

                {!isCollapsed &&
                  rows.map((item) => (
                    <LineItemRow
                      key={item.key}
                      item={item}
                      displayId={lineItemDisplayId(item)}
                      projectOptions={projectOptions}
                      locationOptions={locationsForProject(item.projectId)}
                      notesOpen={notesOpen[item.key] ?? false}
                      onToggleNotes={() =>
                        setNotesOpen((prev) => ({
                          ...prev,
                          [item.key]: !(prev[item.key] ?? false),
                        }))
                      }
                      onChange={(patch) => updateItem(item.key, patch)}
                      onRemove={() => removeItem(item.key)}
                      notesLabel={t('create.lineItems.additionalNotes')}
                      notesOptionalLabel={t('create.optional')}
                      notesPlaceholder={t('create.lineItems.notesPlaceholder')}
                      colCount={colCount}
                    />
                  ))}

                {/* Inline manual entry row (design: empty editable row per group) */}
                {!isCollapsed && (
                  <tr className={TABLE_BODY_ROW} data-testid={`manual-row-${project.id}`}>
                    <td className="py-1.5 px-3 text-muted-foreground">{project.name}</td>
                    <td className="py-1.5 px-3 text-muted-foreground">—</td>
                    <td className="py-1.5 px-1">
                      <input
                        value={draft.name}
                        onChange={(e) => patchManualDraft(project.id, { name: e.target.value })}
                        onBlur={() => commitManualDraft(project.id)}
                        placeholder={t('create.lineItems.manualNamePlaceholder')}
                        className="w-full h-9 px-2 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:bg-muted/40 rounded"
                        data-testid={`manual-name-${project.id}`}
                      />
                    </td>
                    <td className="py-1.5 px-1">
                      <input
                        value={draft.description}
                        onChange={(e) =>
                          patchManualDraft(project.id, { description: e.target.value })
                        }
                        onBlur={() => commitManualDraft(project.id)}
                        placeholder={t('create.lineItems.manualDescriptionPlaceholder')}
                        className="w-full h-9 px-2 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:bg-muted/40 rounded"
                      />
                    </td>
                    <td className="py-1.5 px-1">
                      <StepperInput
                        value={draft.quantity}
                        onValueChange={(value) => patchManualDraft(project.id, { quantity: value })}
                        onBlur={() => commitManualDraft(project.id)}
                        min={0}
                        placeholder="0"
                        data-testid={`manual-qty-${project.id}`}
                      />
                    </td>
                    <td className="py-1.5 px-1">
                      <input
                        value={draft.uom}
                        onChange={(e) => patchManualDraft(project.id, { uom: e.target.value })}
                        onBlur={() => commitManualDraft(project.id)}
                        placeholder={t('create.lineItems.manualUomPlaceholder')}
                        className="w-full h-9 px-2 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:bg-muted/40 rounded"
                        data-testid={`manual-uom-${project.id}`}
                      />
                    </td>
                    <td className="py-1.5 px-1 text-muted-foreground" colSpan={3} />
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>

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

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface LineItemRowProps {
  item: WizardLineItem;
  displayId: string;
  projectOptions: Array<{ value: string; label: string }>;
  locationOptions: Array<{ value: string; label: string }>;
  notesOpen: boolean;
  onToggleNotes: () => void;
  onChange: (patch: Partial<WizardLineItem>) => void;
  onRemove: () => void;
  notesLabel: string;
  notesOptionalLabel: string;
  notesPlaceholder: string;
  colCount: number;
}

function LineItemRow({
  item,
  displayId,
  projectOptions,
  locationOptions,
  notesOpen,
  onToggleNotes,
  onChange,
  onRemove,
  notesLabel,
  notesOptionalLabel,
  notesPlaceholder,
  colCount,
}: LineItemRowProps) {
  return (
    <>
      <tr className={TABLE_BODY_ROW} data-testid={`line-item-${item.key}`}>
        <td className="py-1.5 px-1">
          <CellSelect
            value={item.projectId}
            options={projectOptions}
            onChange={(projectId) => onChange({ projectId, deliveryLocationId: undefined })}
            testId={`line-project-${item.key}`}
          />
        </td>
        <td className="py-1.5 px-3 text-muted-foreground whitespace-nowrap">{displayId}</td>
        <td className="py-1.5 px-3">
          <span className="text-foreground">{item.materialName}</span>
        </td>
        <td className="py-1.5 px-1">
          <input
            value={item.description ?? ''}
            onChange={(e) => onChange({ description: e.target.value })}
            className="w-full h-9 px-2 bg-transparent text-sm text-foreground focus:outline-none focus:bg-muted/40 rounded"
          />
        </td>
        <td className="py-1.5 px-1">
          <StepperInput
            value={String(item.quantity || '')}
            onValueChange={(value) => onChange({ quantity: Number(value) || 0 })}
            min={0}
            data-testid={`line-qty-${item.key}`}
          />
        </td>
        <td className="py-1.5 px-1">
          <input
            value={item.uom}
            onChange={(e) => onChange({ uom: e.target.value })}
            className="w-full h-9 px-2 bg-transparent text-sm text-foreground focus:outline-none focus:bg-muted/40 rounded"
            data-testid={`line-uom-${item.key}`}
          />
        </td>
        <td className="py-1.5 px-1">
          <DatePicker
            value={item.expectedDeliveryDate ?? ''}
            onChange={(date) => onChange({ expectedDeliveryDate: date || undefined })}
            placeholder="mm/dd/yyyy"
            borderless
            editable
          />
        </td>
        <td className="py-1.5 px-1">
          <CellSelect
            value={item.deliveryLocationId}
            options={locationOptions}
            placeholder=""
            onChange={(deliveryLocationId) =>
              onChange({ deliveryLocationId: deliveryLocationId || undefined })
            }
          />
        </td>
        <td className="py-1.5 px-3">
          <div className="flex items-center gap-1">
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
        <tr className="border-t border-border bg-muted/20">
          <td colSpan={colCount} className="py-3 px-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                {notesLabel}{' '}
                <span className="text-muted-foreground font-normal">({notesOptionalLabel})</span>
              </span>
              <Textarea
                rows={2}
                value={item.notes ?? ''}
                onChange={(e) => onChange({ notes: e.target.value || undefined })}
                placeholder={notesPlaceholder}
                data-testid={`line-notes-${item.key}`}
              />
            </label>
          </td>
        </tr>
      )}
    </>
  );
}
