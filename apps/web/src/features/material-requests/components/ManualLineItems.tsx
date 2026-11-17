import type { MaterialSuggestionDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { StepperInput } from '@forethread/ui-components';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import PlusIcon from '@forethread/ui-components/assets/icons/plus.svg?react';
import { useEffect, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';

import type { MrWizardLine } from '../wizard/wizard-types';

import { ManualMaterialNameField } from './ManualMaterialNameField';
import { MaterialThumb } from './MaterialThumb';
import type { NewMaterialDraft } from './NewMaterialModal';

/**
 * One responsive grid template drives both layouts: two labelled columns on
 * phones (name and description span the full width, Qty and Unit sit side by
 * side) and a five-column table-like row from `md` up. Keeping a single DOM
 * avoids duplicate inputs/test ids.
 */
const ROW_GRID =
  'grid grid-cols-2 gap-x-3 gap-y-3 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_104px_120px_40px] md:items-center md:gap-2';

/** Cells that take the full width on phones and one column from `md` up. */
const WIDE_CELL = 'col-span-2 md:col-span-1';

const CELL_INPUT =
  'h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-foreground/50 md:h-9';

const INVALID_INPUT = 'border-destructive focus:border-destructive';

/** The free-text entry being composed in the trailing draft row. */
interface ManualDraft {
  name: string;
  description: string;
  quantity: string;
  unit: string;
  /** Set when the name was picked from the catalogue popup; dropped on edit. */
  materialId?: string;
  /** Catalogue image of the picked material; dropped with `materialId`. */
  imageUrl?: string | null;
}

const EMPTY_DRAFT: ManualDraft = { name: '', description: '', quantity: '', unit: '' };

/** Committed rows and the blank entry row share one look, so both read as lines. */
const ROW_CLASS = `${ROW_GRID} rounded-xl border border-border p-3 md:rounded-none md:border-x-0 md:border-t-0 md:px-2 md:py-2`;

/** Unit applied when a manual line is committed without one. */
const DEFAULT_UNIT = 'Each';

export interface ManualLineItemsProps {
  /** Manual lines already added to the request. */
  lines: MrWizardLine[];
  /** Commit a completed draft row. */
  onAdd: (draft: NewMaterialDraft) => void;
  /** Inline edit of an existing manual line. */
  onPatch: (key: string, patch: Partial<MrWizardLine>) => void;
  onRemove: (key: string) => void;
  /**
   * Reports whether the blank row is complete enough to become a line, so the
   * wizard can enable its Next button before the row has been auto-added.
   */
  onDraftReadyChange?: (ready: boolean) => void;
}

/** Field wrapper: the label shows on phones, the header row covers desktop. */
function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className ?? ''}`}>
      <span className="text-xs font-medium text-muted-foreground md:hidden">{label}</span>
      {children}
    </label>
  );
}

/**
 * Inline manual line-item entry for the Manual tab, matching the RFQ and PO
 * creation flows: an editable list of free-text rows that always ends in a
 * blank entry row whose Material Name searches the catalogue (picking a
 * suggestion links the row to that material). Rows stay editable after they
 * are added.
 *
 * The blank row is permanent (FOR-403): once it has a name and a quantity it
 * becomes a line as soon as focus leaves it (or on Enter / the + button), and
 * a fresh blank row is already in place beneath it. An unfinished blank row is
 * never part of the request, so it is neither validated nor submitted.
 */
export function ManualLineItems({
  lines,
  onAdd,
  onPatch,
  onRemove,
  onDraftReadyChange,
}: ManualLineItemsProps) {
  const { t } = useTranslation('materialRequests');
  const [draft, setDraft] = useState<ManualDraft>(EMPTY_DRAFT);
  const [showDraftErrors, setShowDraftErrors] = useState(false);

  const patchDraft = (patch: Partial<ManualDraft>) => setDraft((prev) => ({ ...prev, ...patch }));

  /** Prefill unit/description from a catalogue pick without clobbering edits. */
  const selectMaterial = (material: MaterialSuggestionDto) =>
    setDraft((prev) => ({
      ...prev,
      name: material.name,
      materialId: material.id,
      imageUrl: material.imageUrl,
      unit: prev.unit.trim() ? prev.unit : (material.uom ?? ''),
      description: prev.description.trim() ? prev.description : (material.description ?? ''),
    }));

  const draftQty = Number(draft.quantity);
  const nameValid = draft.name.trim().length > 0;
  const qtyValid = Number.isFinite(draftQty) && draftQty > 0;

  const draftReady = nameValid && qtyValid;
  useEffect(() => {
    onDraftReadyChange?.(draftReady);
  }, [draftReady, onDraftReadyChange]);
  // The row's contents go when the tab unmounts, so its readiness goes too.
  useEffect(() => () => onDraftReadyChange?.(false), [onDraftReadyChange]);

  const commitDraft = () => {
    if (!nameValid || !qtyValid) {
      setShowDraftErrors(true);
      return;
    }
    onAdd({
      materialName: draft.name.trim(),
      materialId: draft.materialId,
      imageUrl: draft.materialId ? draft.imageUrl : undefined,
      unit: draft.unit.trim() || DEFAULT_UNIT,
      quantity: draftQty,
      description: draft.description.trim() || undefined,
    });
    setDraft(EMPTY_DRAFT);
    setShowDraftErrors(false);
  };

  /** Auto-add: leaving a completed blank row turns it into a line. */
  const handleDraftBlur = (e: FocusEvent<HTMLLIElement>) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (nameValid && qtyValid) commitDraft();
  };

  /**
   * Enter in the blank row's other fields adds it too (the name field has its
   * own `onEnter`). On key-up so the quantity stepper keeps its own key-down
   * digit filter.
   */
  const handleDraftEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitDraft();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Column headers — desktop only; phones use the per-field labels. */}
      <div
        className={`${ROW_GRID} hidden border-b border-border px-2 pb-2 md:grid`}
        aria-hidden="true"
      >
        <span className={`text-xs font-medium text-muted-foreground ${WIDE_CELL}`}>
          {t('requestMaterials.colMaterialName')} <span className="text-destructive">*</span>
        </span>
        <span className={`text-xs font-medium text-muted-foreground ${WIDE_CELL}`}>
          {t('requestMaterials.colDescription')}
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {t('requestMaterials.colQty')} <span className="text-destructive">*</span>
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {t('requestMaterials.colUnit')}
        </span>
        <span className="sr-only">{t('requestMaterials.colActions')}</span>
      </div>

      <ul className="flex flex-col gap-3 md:gap-0" data-testid="mr-manual-list">
        {lines.map((line) => (
          <li key={line.key} className={ROW_CLASS} data-testid={`mr-manual-row-${line.key}`}>
            <Field label={t('requestMaterials.colMaterialName')} className={WIDE_CELL}>
              <ManualMaterialNameField
                value={line.materialName}
                leading={
                  // A catalogue image or the requester's uploaded photo (FOR-404).
                  line.imageUrl ? (
                    <MaterialThumb
                      url={line.imageUrl}
                      alt={line.materialName}
                      className="size-10 rounded-lg md:size-9"
                      fallback={false}
                    />
                  ) : undefined
                }
                onValueChange={(materialName) =>
                  // Editing the name unlinks the catalogue material, image included.
                  onPatch(line.key, {
                    materialName,
                    materialId: undefined,
                    // An uploaded photo (FOR-404) stays; only a catalogue image goes.
                    imageUrl: line.photoFileId ? line.imageUrl : undefined,
                  })
                }
                onSelectMaterial={(material) =>
                  onPatch(line.key, {
                    materialId: material.id,
                    materialName: material.name,
                    imageUrl: line.photoFileId ? line.imageUrl : material.imageUrl,
                    // Keep whatever the foreman already typed; only fill gaps.
                    unit: line.unit.trim()
                      ? line.unit
                      : material.uom?.trim()
                        ? material.uom
                        : DEFAULT_UNIT,
                    description: line.description?.trim()
                      ? line.description
                      : (material.description ?? undefined),
                  })
                }
                placeholder={t('requestMaterials.manualNamePlaceholder')}
                testId={`mr-manual-name-${line.key}`}
              />
            </Field>

            <Field label={t('requestMaterials.colDescription')} className={WIDE_CELL}>
              <input
                value={line.description ?? ''}
                onChange={(e) => onPatch(line.key, { description: e.target.value })}
                placeholder={t('requestMaterials.manualDescriptionPlaceholder')}
                className={CELL_INPUT}
                data-testid={`mr-manual-description-${line.key}`}
              />
            </Field>

            <Field label={t('requestMaterials.colQty')}>
              <StepperInput
                value={line.quantity ? String(line.quantity) : ''}
                onValueChange={(value) => onPatch(line.key, { quantity: Number(value) || 0 })}
                min={0}
                placeholder="0"
                className="h-10 rounded-lg py-0 md:h-9"
                data-testid={`mr-manual-qty-${line.key}`}
              />
            </Field>

            <Field label={t('requestMaterials.colUnit')}>
              <input
                value={line.unit}
                onChange={(e) => onPatch(line.key, { unit: e.target.value })}
                placeholder={DEFAULT_UNIT}
                className={CELL_INPUT}
                data-testid={`mr-manual-unit-${line.key}`}
              />
            </Field>

            <div className={`flex justify-end md:justify-center ${WIDE_CELL}`}>
              <button
                type="button"
                onClick={() => onRemove(line.key)}
                aria-label={t('requestMaterials.removeItem', { name: line.materialName })}
                className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
              >
                <DeleteIcon className="size-4" />
                <span className="md:hidden">{t('requestMaterials.remove')}</span>
              </button>
            </div>
          </li>
        ))}

        {/* Permanent blank row — always the last line, ready for the next item. */}
        <li className={ROW_CLASS} onBlur={handleDraftBlur} data-testid="mr-manual-draft">
          <Field label={t('requestMaterials.colMaterialName')} className={WIDE_CELL}>
            <ManualMaterialNameField
              value={draft.name}
              onValueChange={(name) =>
                patchDraft({ name, materialId: undefined, imageUrl: undefined })
              }
              onSelectMaterial={selectMaterial}
              onEnter={commitDraft}
              placeholder={t('requestMaterials.manualNamePlaceholder')}
              invalid={showDraftErrors && !nameValid}
              className={`${CELL_INPUT} ${showDraftErrors && !nameValid ? INVALID_INPUT : ''}`}
              testId="mr-manual-draft-name"
            />
          </Field>

          <Field label={t('requestMaterials.colDescription')} className={WIDE_CELL}>
            <input
              value={draft.description}
              onChange={(e) => patchDraft({ description: e.target.value })}
              onKeyUp={handleDraftEnter}
              placeholder={t('requestMaterials.manualDescriptionPlaceholder')}
              className={CELL_INPUT}
              data-testid="mr-manual-draft-description"
            />
          </Field>

          <Field label={t('requestMaterials.colQty')}>
            <StepperInput
              value={draft.quantity}
              onValueChange={(quantity) => patchDraft({ quantity })}
              onKeyUp={handleDraftEnter}
              min={0}
              placeholder="0"
              className={`h-10 rounded-lg py-0 md:h-9 ${
                showDraftErrors && !qtyValid ? INVALID_INPUT : ''
              }`}
              aria-invalid={showDraftErrors && !qtyValid ? true : undefined}
              data-testid="mr-manual-draft-qty"
            />
          </Field>

          <Field label={t('requestMaterials.colUnit')}>
            <input
              value={draft.unit}
              onChange={(e) => patchDraft({ unit: e.target.value })}
              onKeyUp={handleDraftEnter}
              placeholder={DEFAULT_UNIT}
              className={CELL_INPUT}
              data-testid="mr-manual-draft-unit"
            />
          </Field>

          <button
            type="button"
            onClick={commitDraft}
            aria-label={t('requestMaterials.addRow')}
            className={`${WIDE_CELL} flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-foreground text-sm font-medium text-foreground transition-colors hover:bg-accent/50 md:size-9 md:w-auto md:border-0 md:bg-foreground md:text-background md:hover:bg-foreground/90`}
            data-testid="mr-manual-draft-add"
          >
            <PlusIcon className="size-4" />
            <span className="md:hidden">{t('requestMaterials.addRow')}</span>
          </button>
        </li>
      </ul>

      {showDraftErrors && (!nameValid || !qtyValid) && (
        <p className="text-xs text-destructive" role="alert" data-testid="mr-manual-draft-error">
          {!nameValid
            ? t('requestMaterials.manualNameRequired')
            : t('requestMaterials.manualQtyRequired')}
        </p>
      )}

      <p className="text-xs text-muted-foreground">{t('requestMaterials.manualHint')}</p>
    </div>
  );
}
