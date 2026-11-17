import { useTranslation } from '@forethread/i18n';
import { NAKED_INPUT_CLASS, UOM_OPTIONS } from '@forethread/po-shared';
import { BOM_MATCH_CONFIDENCE_THRESHOLD } from '@forethread/shared-types/client';
import {
  Alert,
  Badge,
  Button,
  CustomDropdown,
  Input,
  LineItemEditor,
  MaterialSearchPanel,
  cn,
  onDecimalOnly,
  type LineItemField,
  type MaterialItem,
  ScrollTable,
  useIsPhone,
} from '@forethread/ui-components';
import CheckIcon from '@forethread/ui-components/assets/icons/check-stroke.svg?react';
import ChevronDownIcon from '@forethread/ui-components/assets/icons/chevron-down.svg?react';
import CopyIcon from '@forethread/ui-components/assets/icons/copy.svg?react';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import { useEffect, useState, type ReactNode } from 'react';

import { useMaterialSearchQuery } from '../../hooks/useMaterialSearchQuery';

import {
  acceptSuggestion,
  dismissSuggestion,
  emptyRow,
  firstNonEmpty,
  isRowEmpty,
  pendingSuggestion,
  pendingSuggestionCount,
  unmatchedCount,
  type BomDraftRow,
} from './bom-draft';
import { CreatePrivateMaterialModal } from './CreatePrivateMaterialModal';

type TFn = (key: string, options?: Record<string, unknown>) => string;

type BomFieldKey = 'materialName' | 'match' | 'uom' | 'quantity' | 'confidence';

// Row tints from the US 5.01 design: red = no match and nothing suggested (or
// the suggestion was ignored), amber = a suggestion waiting to be accepted or
// ignored, blue = resolved by hand.
const ROW_TINT = {
  red: 'bg-[#FFC9CB]/60',
  amber: 'bg-[#FFE6CA]/60',
  blue: 'bg-[#C5E3FF]/60',
} as const;

function rowTint(row: BomDraftRow): string {
  if (isRowEmpty(row)) return '';
  if (row.manuallyResolved) return ROW_TINT.blue;
  if (!row.matchedMaterialId) return pendingSuggestion(row) ? ROW_TINT.amber : ROW_TINT.red;
  // Matched lines get no tint, whatever their score: the confidence badge
  // still shows it, and amber means only "waiting for a decision".
  return '';
}

function confidenceBadge(row: BomDraftRow, t: TFn): { label: string; pct: string | null } {
  const score = row.matchedMaterialId
    ? row.matchConfidence
    : (pendingSuggestion(row)?.confidence ?? null);
  if (row.matchedMaterialId && score === null) return { label: t('create.manual'), pct: null };
  if (score === null) return { label: t('create.noMatch'), pct: null };
  const pct = `${Math.round(score * 100)}%`;
  if (score >= BOM_MATCH_CONFIDENCE_THRESHOLD) return { label: t('create.high'), pct };
  if (score >= 0.5) return { label: t('create.medium'), pct };
  return { label: t('create.low'), pct };
}

/** Match-cell display text: confirmed match, else pending suggestion, else "Select". */
function matchCellText(row: BomDraftRow, t: TFn): { text: string; muted: boolean } {
  if (row.matchedMaterialName) return { text: row.matchedMaterialName, muted: false };
  const suggestion = pendingSuggestion(row);
  if (suggestion) return { text: suggestion.name, muted: true };
  return { text: t('create.select'), muted: true };
}

/** Catalogue image of whichever material `matchCellText` names, if it has one. */
function matchCellImageUrl(row: BomDraftRow): string | null {
  if (row.matchedMaterialName) return row.matchedImageUrl ?? null;
  return pendingSuggestion(row)?.imageUrl ?? null;
}

/**
 * Catalogue image beside the matched material name (FOR-402). A plain image
 * rather than a link because it sits inside the match button; renders nothing
 * without a URL or when the image fails to load.
 */
function MatchThumb({ url, name }: { url: string | null; name: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!url || failedUrl === url) return null;
  return (
    <img
      src={url}
      alt={name}
      loading="lazy"
      onError={() => setFailedUrl(url)}
      className="h-7 w-7 shrink-0 rounded border border-border object-cover"
      data-testid="bom-match-thumb"
    />
  );
}

interface MatchCellProps {
  index: number;
  row: BomDraftRow;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPick: (material: MaterialItem) => void;
  onCreateNew: () => void;
  /** Accept / ignore the row's pending suggestion. */
  onAccept: () => void;
  onDismiss: () => void;
  t: TFn;
}

function MatchCell({
  index,
  row,
  open,
  onOpen,
  onClose,
  onPick,
  onCreateNew,
  onAccept,
  onDismiss,
  t,
}: MatchCellProps) {
  const [query, setQuery] = useState('');
  const { results, totalCount } = useMaterialSearchQuery(query);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  if (!open) {
    const { text, muted } = matchCellText(row, t);
    const pending = pendingSuggestion(row) !== null;
    const decide =
      'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground';
    return (
      <div className="flex w-full items-center gap-1">
        <button
          type="button"
          onClick={onOpen}
          data-testid={`bom-match-cell-${index}`}
          className="flex min-w-0 flex-1 items-center justify-between gap-1 h-9 px-2 text-sm text-left hover:bg-muted/40 rounded"
        >
          <span className="flex min-w-0 items-center gap-2">
            <MatchThumb url={matchCellImageUrl(row)} name={text} />
            <span className={cn('truncate', muted ? 'text-muted-foreground' : 'text-foreground')}>
              {text}
            </span>
          </span>
          <ChevronDownIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
        </button>
        {pending && (
          <>
            <button
              type="button"
              onClick={onAccept}
              aria-label={t('create.acceptSuggestion')}
              title={t('create.acceptSuggestion')}
              data-testid={`bom-accept-suggestion-${index}`}
              className={cn(decide, 'hover:border-success-600 hover:text-success-600')}
            >
              <CheckIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t('create.ignoreSuggestion')}
              title={t('create.ignoreSuggestion')}
              data-testid={`bom-ignore-suggestion-${index}`}
              className={cn(decide, 'mr-1 hover:border-destructive hover:text-destructive')}
            >
              <CrossIcon className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <MaterialSearchPanel
      compact
      search={query}
      onSearchChange={setQuery}
      results={results}
      resultsCount={totalCount}
      selected={[]}
      onSelect={() => undefined}
      onDeselect={() => undefined}
      onQuantityChange={() => undefined}
      onAddToList={() => undefined}
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      searchPlaceholder={t('create.select')}
      resultsLabel={t('create.resultsLabel')}
      filtersLabel={t('create.filtersLabel')}
      onPickItem={onPick}
      footerAction={
        <button
          type="button"
          onClick={onCreateNew}
          data-testid={`bom-create-material-${index}`}
          className="w-full h-[42px] rounded-xl bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
        >
          {t('create.createPrivateMaterial')}
        </button>
      }
    />
  );
}

export interface BomReviewStepProps {
  rows: BomDraftRow[];
  onRowsChange: (rows: BomDraftRow[]) => void;
  /**
   * 'create' (default) is the upload wizard: shows the unmatched warning
   * alert and colour-codes rows by match state. 'edit' (US 5.02 Edit BOM) is
   * the cleaner in-place editor — the page owns its own info banner, so the
   * alert and row tints are suppressed to match the design.
   */
  variant?: 'create' | 'edit';
}

/**
 * Step 2 of 3 — Review Extracted Items. Editable line-item table; each line is
 * matched to a catalogue material (via the search popup or by creating a
 * private material). Lines left unmatched are flagged but don't block the
 * wizard — the page confirms them before continuing.
 */
export function BomReviewStep({ rows, onRowsChange, variant = 'create' }: BomReviewStepProps) {
  const { t: tRaw } = useTranslation('boms');
  const t = tRaw as TFn;
  const isPhone = useIsPhone();
  const [openMatchRow, setOpenMatchRow] = useState<number | null>(null);
  const [createMaterialRow, setCreateMaterialRow] = useState<number | null>(null);

  // Keep one empty trailing row so users can add lines manually (the design's
  // "Enter" placeholder row).
  useEffect(() => {
    if (rows.length === 0 || !isRowEmpty(rows[rows.length - 1])) {
      onRowsChange([...rows, emptyRow()]);
    }
  }, [rows, onRowsChange]);

  const updateRow = (index: number, patch: Partial<BomDraftRow>) => {
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const duplicateRow = (index: number) => {
    const next = [...rows];
    next.splice(index + 1, 0, { ...rows[index] });
    onRowsChange(next);
  };

  const removeRow = (index: number) => {
    onRowsChange(rows.filter((_, i) => i !== index));
  };

  const pickMaterial = (index: number, material: MaterialItem) => {
    const candidate = rows[index].candidates.find((c) => c.materialId === material.id);
    updateRow(index, {
      matchedMaterialId: material.id,
      matchedMaterialName: material.name,
      // Display only (see BomDraftRow.matchedImageUrl).
      matchedImageUrl: material.imageUrl ?? candidate?.imageUrl ?? null,
      // Confirming a scored suggestion keeps its score; a fresh pick is the
      // human's call ("Manual").
      matchConfidence: candidate?.confidence ?? null,
      suggestionDismissed: false,
      uom: firstNonEmpty(rows[index].uom, material.unit),
      // Category / type have no column — they ride along with the line and are
      // saved with it. A manual pick is authoritative about the material, so
      // its catalogue values replace any carried from the prior suggestion;
      // fall back to the existing value only when the picked material lacks one.
      category: firstNonEmpty(material.category, rows[index].category),
      materialType: firstNonEmpty(material.subCategory, rows[index].materialType),
      manuallyResolved: true,
    });
    setOpenMatchRow(null);
  };

  const unmatched = unmatchedCount(rows);
  const pending = pendingSuggestionCount(rows);

  const th =
    'px-3 py-3 text-left text-xs font-bold leading-4 tracking-[0.6px] whitespace-nowrap text-[hsl(var(--table-header-foreground))]';
  const td = 'px-1 py-1 border-t border-border align-middle';

  const uomOptionsFor = (value: string) => {
    const base = UOM_OPTIONS.map((o) => ({ value: o.value as string, label: o.label as string }));
    if (value && !base.some((o) => o.value === value)) base.unshift({ value, label: value });
    return base;
  };

  // ── Line fields, defined once (ADR-0019 B10): the desktop table renders the
  // inputs in its cells; on phones LineItemEditor stacks them in the line sheet.
  const inputClass = isPhone ? undefined : NAKED_INPUT_CLASS;
  const bomFields: Array<LineItemField<BomDraftRow> & { key: BomFieldKey }> = [
    {
      key: 'materialName',
      label: t('create.columns.materialName'),
      input: (row, index) => (
        <Input
          aria-label={t('create.columns.materialName')}
          value={row.materialName}
          placeholder={t('create.enterPlaceholder')}
          onChange={(e) => updateRow(index, { materialName: e.target.value })}
          className={inputClass}
        />
      ),
    },
    {
      key: 'match',
      label: t('create.columns.match'),
      required: true,
      value: (row) => matchCellText(row, t).text,
      input: (row, index) => (
        <div className={isPhone ? 'rounded-xl border border-border bg-background' : undefined}>
          <MatchCell
            index={index}
            row={row}
            open={openMatchRow === index}
            onOpen={() => setOpenMatchRow(index)}
            onClose={() => setOpenMatchRow(null)}
            onPick={(material) => pickMaterial(index, material)}
            onCreateNew={() => {
              setOpenMatchRow(null);
              setCreateMaterialRow(index);
            }}
            onAccept={() => updateRow(index, acceptSuggestion(row))}
            onDismiss={() => updateRow(index, dismissSuggestion(row))}
            t={t}
          />
        </div>
      ),
    },
    {
      key: 'uom',
      label: t('create.columns.uom'),
      value: (row) => row.uom || '-',
      input: (row, index) => (
        <CustomDropdown
          options={uomOptionsFor(row.uom)}
          value={row.uom}
          onChange={(value) => updateRow(index, { uom: value })}
          placeholder="UoM"
          borderless={!isPhone}
        />
      ),
    },
    {
      key: 'quantity',
      label: t('create.columns.quantity'),
      value: (row) => row.quantity || '-',
      input: (row, index) => (
        <div className="flex items-center gap-1 pr-1">
          <Input
            aria-label={t('create.columns.quantity')}
            inputMode="decimal"
            onKeyDown={onDecimalOnly}
            value={row.quantity}
            placeholder={isRowEmpty(row) ? t('create.enterPlaceholder') : '0'}
            onChange={(e) => updateRow(index, { quantity: e.target.value })}
            className={isPhone ? undefined : cn(NAKED_INPUT_CLASS, 'w-16')}
          />
          <div className="flex flex-col shrink-0">
            <button
              type="button"
              tabIndex={-1}
              aria-label="Increase quantity"
              onClick={() =>
                updateRow(index, {
                  quantity: String((Number(row.quantity) || 0) + 1),
                })
              }
              className="p-0.5 text-muted-foreground hover:text-foreground"
            >
              <ChevronDownIcon className="w-3.5 h-3.5 rotate-180" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Decrease quantity"
              onClick={() =>
                updateRow(index, {
                  quantity: String(Math.max(0, (Number(row.quantity) || 0) - 1)),
                })
              }
              className="p-0.5 text-muted-foreground hover:text-foreground"
            >
              <ChevronDownIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ),
    },
    {
      key: 'confidence',
      label: t('create.columns.confidence'),
      input: (row) => {
        const badge = confidenceBadge(row, t);
        return (
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <Badge className="bg-[#E8EAED] text-[#2D3139]">{badge.label}</Badge>
            {badge.pct && <span className="text-sm text-foreground">{badge.pct}</span>}
          </span>
        );
      },
    },
  ];
  const field = (key: BomFieldKey, row: BomDraftRow, index: number): ReactNode =>
    bomFields.find((f) => f.key === key)?.input(row, index) ?? null;

  return (
    <div className="space-y-6" data-testid="bom-review-step">
      {variant === 'create' && unmatched > 0 && (
        <Alert variant="warning" icon={<InfoIcon className="w-[18px] h-[18px]" />}>
          {t('create.unmatchedAlert', { count: unmatched })}
        </Alert>
      )}

      {/* Bulk decision on the suggestions still waiting; gone once none are. */}
      {pending > 0 && (
        <div
          className="flex flex-wrap items-center justify-end gap-3"
          data-testid="bom-suggestion-actions"
        >
          <Button
            variant="outline"
            onClick={() => onRowsChange(rows.map(dismissSuggestion))}
            data-testid="bom-ignore-all"
          >
            {t('create.ignoreAllSuggestions')}
          </Button>
          <Button
            onClick={() => onRowsChange(rows.map(acceptSuggestion))}
            data-testid="bom-accept-all"
          >
            {t('create.acceptAllSuggestions', { count: pending })}
          </Button>
        </div>
      )}

      {/* Phones: one card per line + the line edit sheet (B10). */}
      {isPhone && (
        <LineItemEditor
          lines={rows}
          fields={bomFields}
          getKey={(_row, index) => String(index)}
          getTitle={(row) =>
            firstNonEmpty(row.materialName, row.description) || t('create.enterPlaceholder')
          }
          getSubtitle={(row) => (isRowEmpty(row) ? undefined : confidenceBadge(row, t).label)}
          hasError={(row) => variant === 'create' && !isRowEmpty(row) && !row.matchedMaterialId}
          onRemove={removeRow}
          removeLabel={t('create.removeRow')}
        />
      )}

      {!isPhone && (
        <div className="bg-card border border-border rounded-lg overflow-visible">
          <ScrollTable className="overflow-y-visible">
            <table
              className="w-full min-w-[1040px] table-fixed text-sm"
              data-testid="bom-review-table"
            >
              <thead>
                {/* Fixed layout: the small columns keep a set width and the
                    material name takes whatever is left. */}
                <tr className="bg-[hsl(var(--table-header))]">
                  <th className={th}>{t('create.columns.materialName')}</th>
                  <th className={cn(th, 'w-[26%]')}>{t('create.columns.match')}</th>
                  <th className={cn(th, 'w-[110px]')}>{t('create.columns.uom')}</th>
                  <th className={cn(th, 'w-[110px]')}>{t('create.columns.quantity')}</th>
                  <th className={cn(th, 'w-[150px]')}>{t('create.columns.confidence')}</th>
                  <th className={cn(th, 'w-[90px]')}>{t('create.columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const empty = isRowEmpty(row);
                  return (
                    <tr
                      key={index}
                      className={variant === 'edit' ? undefined : rowTint(row)}
                      data-testid={`bom-review-row-${index}`}
                    >
                      <td className={td}>{field('materialName', row, index)}</td>
                      <td className={cn(td, 'relative')}>{field('match', row, index)}</td>
                      <td className={td}>{field('uom', row, index)}</td>
                      <td className={td}>{field('quantity', row, index)}</td>
                      <td className={cn(td, 'px-3')}>{field('confidence', row, index)}</td>
                      <td className={cn(td, 'px-3')}>
                        <div className="flex items-center gap-3">
                          {variant !== 'edit' && (
                            <button
                              type="button"
                              aria-label={t('create.duplicateRow')}
                              title={t('create.duplicateRow')}
                              onClick={() => duplicateRow(index)}
                              disabled={empty}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                            >
                              <CopyIcon className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label={t('create.removeRow')}
                            title={t('create.removeRow')}
                            onClick={() => removeRow(index)}
                            disabled={empty}
                            className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                          >
                            <DeleteIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollTable>
        </div>
      )}

      {createMaterialRow !== null && (
        <CreatePrivateMaterialModal
          initialName={firstNonEmpty(
            rows[createMaterialRow]?.materialName,
            rows[createMaterialRow]?.description,
          )}
          initialUom={rows[createMaterialRow]?.uom}
          initialDescription={rows[createMaterialRow]?.description}
          onClose={() => setCreateMaterialRow(null)}
          onCreated={(material) => {
            updateRow(createMaterialRow, {
              matchedMaterialId: material.id,
              matchedMaterialName: material.name,
              matchedImageUrl: material.imageUrl ?? null,
              matchConfidence: null,
              uom: firstNonEmpty(rows[createMaterialRow].uom, material.unitOfMeasure),
              // The newly created material defines the line, so its category /
              // type win over any suggestion-derived values on the row.
              category: firstNonEmpty(material.categoryName, rows[createMaterialRow].category),
              materialType: firstNonEmpty(
                material.subCategory,
                rows[createMaterialRow].materialType,
              ),
              manuallyResolved: true,
            });
            setCreateMaterialRow(null);
          }}
        />
      )}
    </div>
  );
}
