import type { MaterialListItemDto } from '@forethread/api-client';
import {
  Button,
  Checkbox,
  CustomDropdown,
  FormField,
  Input,
  Textarea,
  onDecimalOnly,
} from '@forethread/ui-components';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import { useMemo, useState } from 'react';

export interface RfqLineItemDraft {
  materialId: string;
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
  error?: string;
}

export function StepMaterials({
  materials,
  search,
  onSearchChange,
  lineItems,
  onAdd,
  onRemove,
  error,
}: StepMaterialsProps) {
  const [materialId, setMaterialId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [uom, setUom] = useState('');
  const [costCode, setCostCode] = useState('');
  const [notes, setNotes] = useState('');
  const [pickUp, setPickUp] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const materialOptions = useMemo(
    () => materials.map((m) => ({ value: m.id, label: m.name })),
    [materials],
  );

  const selectMaterial = (id: string) => {
    setMaterialId(id);
    const material = materials.find((m) => m.id === id);
    if (material && !uom) setUom(material.unitOfMeasure);
  };

  const handleAdd = () => {
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
              key={`${item.materialId}-${index}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{item.materialName}</p>
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
            <Input value={uom} onChange={(e) => setUom(e.target.value)} placeholder="e.g. bag" />
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

        <Button type="button" variant="outline" onClick={handleAdd} data-testid="add-line-item">
          Add material
        </Button>
      </div>
    </section>
  );
}
