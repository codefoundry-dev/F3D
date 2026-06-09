import type { MaterialListItemDto } from '@forethread/api-client';
import { isBomExtractionResult, type BomLineItem } from '@forethread/shared-types/client';
import {
  Badge,
  Button,
  Checkbox,
  CustomDropdown,
  FormField,
  Input,
  RadioGroup,
  Textarea,
  onDecimalOnly,
} from '@forethread/ui-components';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import { useMemo, useState } from 'react';

import type { ConfirmedBomSummary } from '@/features/doc-intelligence';

import { bomLineToRfqDraftFields } from './bom-draft';

/** Where a draft line item originated. Local string-union (avoids importing the
 * RfqLineItemSource enum from the shared-types root barrel, which would pull in
 * @nestjs/swagger and break Vite). */
export type RfqLineItemSourceValue = 'CATALOG' | 'BOM';

export interface RfqLineItemDraft {
  source?: RfqLineItemSourceValue;
  /** Present only for catalogue-sourced lines. */
  materialId?: string;
  /** Always set — used for display. For BOM lines it carries the free-text name. */
  materialName: string;
  quantity: number;
  uom: string;
  costCode?: string;
  notes?: string;
  pickUp?: boolean;
}

interface StepMaterialsProps {
  materials: MaterialListItemDto[];
  search: string;
  onSearchChange: (value: string) => void;
  lineItems: RfqLineItemDraft[];
  onAdd: (item: RfqLineItemDraft) => void;
  onRemove: (index: number) => void;
  /** Confirmed BOMs eligible to seed RFQ line items (FOR-204). */
  confirmedBoms?: ConfirmedBomSummary[];
  error?: string;
}

const SOURCE_OPTIONS = [
  { value: 'CATALOG', label: 'From catalogue' },
  { value: 'BOM', label: 'From BOM' },
];

/** Returns the first non-empty, trimmed string, or undefined if none qualify. */
function firstNonEmpty(...values: (string | null | undefined)[]): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

/** Per-row editable state for a selectable BOM line. */
interface BomRowState {
  selected: boolean;
  quantity: string;
  uom: string;
}

export function StepMaterials({
  materials,
  search,
  onSearchChange,
  lineItems,
  onAdd,
  onRemove,
  confirmedBoms = [],
  error,
}: StepMaterialsProps) {
  const [sourceMode, setSourceMode] = useState<RfqLineItemSourceValue>('CATALOG');

  // ── Catalogue form state ────────────────────────────────────────────────
  const [materialId, setMaterialId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [uom, setUom] = useState('');
  const [costCode, setCostCode] = useState('');
  const [notes, setNotes] = useState('');
  const [pickUp, setPickUp] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── BOM form state ──────────────────────────────────────────────────────
  const [bomId, setBomId] = useState('');
  const [bomRows, setBomRows] = useState<Record<number, BomRowState>>({});
  const [bomError, setBomError] = useState<string | null>(null);

  const materialOptions = useMemo(
    () => materials.map((m) => ({ value: m.id, label: m.name })),
    [materials],
  );

  const bomOptions = useMemo(
    () =>
      confirmedBoms.map((bom) => {
        const result = isBomExtractionResult(bom.editedResult) ? bom.editedResult : null;
        const label = firstNonEmpty(result?.title, result?.projectName, bom.file.filename) ?? 'BOM';
        return { value: bom.id, label };
      }),
    [confirmedBoms],
  );

  const selectedBomItems = useMemo<BomLineItem[]>(() => {
    const bom = confirmedBoms.find((b) => b.id === bomId);
    if (!bom || !isBomExtractionResult(bom.editedResult)) return [];
    return bom.editedResult.items;
  }, [confirmedBoms, bomId]);

  const selectMaterial = (id: string) => {
    setMaterialId(id);
    const material = materials.find((m) => m.id === id);
    if (material && !uom) setUom(material.unitOfMeasure);
  };

  const handleAddCatalogue = () => {
    const qty = Number(quantity);
    if (!materialId) {
      setFormError('Select a material');
      return;
    }
    if (!quantity || Number.isNaN(qty) || qty < 0.01) {
      setFormError('Enter a quantity of at least 0.01');
      return;
    }
    if (!uom.trim()) {
      setFormError('Enter a unit of measure');
      return;
    }
    const material = materials.find((m) => m.id === materialId);
    onAdd({
      source: 'CATALOG',
      materialId,
      materialName: material?.name ?? 'Material',
      quantity: qty,
      uom: uom.trim(),
      costCode: costCode.trim() || undefined,
      notes: notes.trim() || undefined,
      pickUp: pickUp || undefined,
    });
    setMaterialId('');
    setQuantity('');
    setUom('');
    setCostCode('');
    setNotes('');
    setPickUp(false);
    setFormError(null);
  };

  const selectBom = (id: string) => {
    setBomId(id);
    setBomRows({});
    setBomError(null);
  };

  const toggleBomRow = (index: number, item: BomLineItem, checked: boolean) => {
    setBomRows((prev) => {
      const existing = prev[index];
      const next: BomRowState = checked
        ? {
            selected: true,
            quantity: existing?.quantity ?? (item.quantity !== null ? String(item.quantity) : ''),
            uom: existing?.uom ?? item.unit ?? '',
          }
        : { selected: false, quantity: existing?.quantity ?? '', uom: existing?.uom ?? '' };
      return { ...prev, [index]: next };
    });
  };

  const updateBomRow = (index: number, patch: Partial<Omit<BomRowState, 'selected'>>) => {
    setBomRows((prev) => {
      const existing = prev[index] ?? { selected: false, quantity: '', uom: '' };
      return { ...prev, [index]: { ...existing, ...patch } };
    });
  };

  const handleAddBom = () => {
    const chosen = selectedBomItems
      .map((item, index) => ({ item, row: bomRows[index] }))
      .filter((entry): entry is { item: BomLineItem; row: BomRowState } =>
        Boolean(entry.row?.selected),
      );

    if (chosen.length === 0) {
      setBomError('Select at least one BOM line');
      return;
    }

    const drafts: RfqLineItemDraft[] = [];
    for (const { item, row } of chosen) {
      const qty = Number(row.quantity);
      if (!row.quantity || Number.isNaN(qty) || qty < 0.01) {
        setBomError('Enter a quantity of at least 0.01 for each selected line');
        return;
      }
      if (!row.uom.trim()) {
        setBomError('Enter a unit of measure for each selected line');
        return;
      }
      // A matched line carries its catalogue materialId (catalogue-linked);
      // an unmatched line keeps its free-text name.
      drafts.push({
        source: 'BOM',
        ...bomLineToRfqDraftFields(item),
        quantity: qty,
        uom: row.uom.trim(),
      });
    }

    for (const draft of drafts) onAdd(draft);

    setBomId('');
    setBomRows({});
    setBomError(null);
  };

  return (
    <section className="bg-card rounded-lg border border-border p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Materials</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add at least one material to request quotes for.
        </p>
      </div>

      {/* Added line items */}
      {lineItems.length > 0 && (
        <ul className="space-y-2" data-testid="line-item-list">
          {lineItems.map((item, index) => (
            <li
              key={index}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{item.materialName}</p>
                  <Badge className="bg-muted text-muted-foreground">
                    {item.source === 'BOM' ? 'BOM' : 'Catalogue'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.quantity} {item.uom}
                  {item.costCode ? ` · ${item.costCode}` : ''}
                  {item.pickUp ? ' · Pick-up' : ''}
                </p>
                {item.notes && <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>}
              </div>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                aria-label={`Remove ${item.materialName}`}
              >
                <DeleteIcon className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Add line item form */}
      <div className="rounded-lg border border-dashed border-border p-4 space-y-4">
        <FormField label="Source">
          <RadioGroup
            options={SOURCE_OPTIONS}
            value={sourceMode}
            onChange={(value) => setSourceMode(value as RfqLineItemSourceValue)}
            name="line-item-source"
          />
        </FormField>

        {sourceMode === 'CATALOG' ? (
          <div className="space-y-4" data-testid="catalogue-fields">
            <FormField label="Search catalogue">
              <Input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search materials by name"
              />
            </FormField>

            <FormField label="Material">
              <CustomDropdown
                options={materialOptions}
                value={materialId}
                onChange={selectMaterial}
                searchable
                placeholder="Select a material"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Quantity">
                <Input
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  onKeyDown={onDecimalOnly}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                />
              </FormField>
              <FormField label="Unit of measure">
                <Input
                  value={uom}
                  onChange={(e) => setUom(e.target.value)}
                  placeholder="e.g. bag"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Cost code (optional)">
                <Input
                  value={costCode}
                  onChange={(e) => setCostCode(e.target.value)}
                  placeholder="e.g. CC-100"
                />
              </FormField>
              <div className="flex items-end pb-2.5">
                <Checkbox checked={pickUp} onChange={setPickUp} label="Pick-up" />
              </div>
            </div>

            <FormField label="Notes (optional)">
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any specifications for this material"
              />
            </FormField>

            {formError && <p className="text-xs text-destructive">{formError}</p>}

            <Button
              type="button"
              variant="outline"
              onClick={handleAddCatalogue}
              data-testid="add-line-item"
            >
              Add material
            </Button>
          </div>
        ) : (
          <div className="space-y-4" data-testid="bom-fields">
            <FormField label="Bill of materials">
              <CustomDropdown
                options={bomOptions}
                value={bomId}
                onChange={selectBom}
                searchable
                placeholder="Select a confirmed BOM"
              />
            </FormField>

            {bomId && selectedBomItems.length === 0 && (
              <p className="text-sm text-muted-foreground">This BOM has no line items.</p>
            )}

            {selectedBomItems.length > 0 && (
              <ul className="space-y-2" data-testid="bom-line-list">
                {selectedBomItems.map((item, index) => {
                  const row = bomRows[index];
                  const selected = row?.selected ?? false;
                  return (
                    <li
                      key={index}
                      className="rounded-lg border border-border bg-background p-3 space-y-3"
                      data-testid={`bom-line-${index}`}
                    >
                      <Checkbox
                        checked={selected}
                        onChange={(checked) => toggleBomRow(index, item, checked)}
                        label={item.description}
                      />
                      {selected && (
                        <div className="grid grid-cols-2 gap-4 pl-6">
                          <FormField label="Quantity">
                            <Input
                              inputMode="decimal"
                              pattern="[0-9]*\.?[0-9]*"
                              onKeyDown={onDecimalOnly}
                              value={row?.quantity ?? ''}
                              onChange={(e) => updateBomRow(index, { quantity: e.target.value })}
                              placeholder="0"
                              data-testid={`bom-line-${index}-quantity`}
                            />
                          </FormField>
                          <FormField label="Unit of measure">
                            <Input
                              value={row?.uom ?? ''}
                              onChange={(e) => updateBomRow(index, { uom: e.target.value })}
                              placeholder="e.g. bag"
                              data-testid={`bom-line-${index}-uom`}
                            />
                          </FormField>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {bomError && <p className="text-xs text-destructive">{bomError}</p>}

            <Button
              type="button"
              variant="outline"
              onClick={handleAddBom}
              disabled={selectedBomItems.length === 0}
              data-testid="add-bom-line-items"
            >
              Add selected
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
