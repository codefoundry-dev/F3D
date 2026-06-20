import { getMaterialCategories } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { NAKED_INPUT_CLASS, UOM_OPTIONS } from '@forethread/po-shared';
import { BOM_MATCH_CONFIDENCE_THRESHOLD } from '@forethread/shared-types/client';
import {
  Alert,
  Badge,
  CustomDropdown,
  Input,
  MaterialSearchPanel,
  cn,
  onDecimalOnly,
  type MaterialItem,
} from '@forethread/ui-components';
import ChevronDownIcon from '@forethread/ui-components/assets/icons/chevron-down.svg?react';
import CopyIcon from '@forethread/ui-components/assets/icons/copy.svg?react';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useMaterialSearchQuery } from '../../hooks/useMaterialSearchQuery';

import { emptyRow, firstNonEmpty, isRowEmpty, unmatchedCount, type BomDraftRow } from './bom-draft';
import { CreatePrivateMaterialModal } from './CreatePrivateMaterialModal';

type TFn = (key: string, options?: Record<string, unknown>) => string;

// Row tints from the US 5.01 design: red = no match and no candidates,
// amber = unmatched with a low-confidence suggestion, blue = resolved by hand.
const ROW_TINT = {
  red: 'bg-[#FFC9CB]/60',
  amber: 'bg-[#FFE6CA]/60',
  blue: 'bg-[#C5E3FF]/60',
} as const;

function rowTint(row: BomDraftRow): string {
  if (isRowEmpty(row)) return '';
  if (row.manuallyResolved) return ROW_TINT.blue;
  if (!row.matchedMaterialId) return row.candidates.length > 0 ? ROW_TINT.amber : ROW_TINT.red;
  // Auto-accepted low-confidence suggestion: matched so the wizard can proceed,
  // but kept amber to flag it for review. A high-confidence match gets no tint.
  if (row.matchConfidence !== null && row.matchConfidence < BOM_MATCH_CONFIDENCE_THRESHOLD) {
    return ROW_TINT.amber;
  }
  return '';
}

function confidenceBadge(row: BomDraftRow, t: TFn): { label: string; pct: string | null } {
  const score = row.matchedMaterialId
    ? row.matchConfidence
    : (row.candidates[0]?.confidence ?? null);
  if (row.matchedMaterialId && score === null) return { label: t('create.manual'), pct: null };
  if (score === null) return { label: t('create.noMatch'), pct: null };
  const pct = `${Math.round(score * 100)}%`;
  if (score >= BOM_MATCH_CONFIDENCE_THRESHOLD) return { label: t('create.high'), pct };
  if (score >= 0.5) return { label: t('create.medium'), pct };
  return { label: t('create.low'), pct };
}

/** Match-cell display text: confirmed match, else best suggestion, else "Select". */
function matchCellText(row: BomDraftRow, t: TFn): { text: string; muted: boolean } {
  if (row.matchedMaterialName) return { text: row.matchedMaterialName, muted: false };
  if (row.candidates[0]) return { text: row.candidates[0].name, muted: true };
  return { text: t('create.select'), muted: true };
}

interface MatchCellProps {
  index: number;
  row: BomDraftRow;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPick: (material: MaterialItem) => void;
  onCreateNew: () => void;
  t: TFn;
}

function MatchCell({ index, row, open, onOpen, onClose, onPick, onCreateNew, t }: MatchCellProps) {
  const [query, setQuery] = useState('');
  const { results, totalCount } = useMaterialSearchQuery(query);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  if (!open) {
    const { text, muted } = matchCellText(row, t);
    return (
      <button
        type="button"
        onClick={onOpen}
        data-testid={`bom-match-cell-${index}`}
        className="flex w-full items-center justify-between gap-1 h-9 px-2 text-sm text-left hover:bg-muted/40 rounded"
      >
        <span className={cn('truncate', muted ? 'text-muted-foreground' : 'text-foreground')}>
          {text}
        </span>
        <ChevronDownIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
      </button>
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
   * 'create' (default) is the upload wizard: shows the destructive unmatched
   * alert and colour-codes rows by match state. 'edit' (US 5.02 Edit BOM) is
   * the cleaner in-place editor — the page owns its own info banner, so the
   * alert and row tints are suppressed to match the design.
   */
  variant?: 'create' | 'edit';
}

/**
 * Step 2 of 3 — Review Extracted Items. Editable line-item table; every line
 * must be matched to a catalogue material (via the search popup or by creating
 * a private material) before the wizard can continue.
 */
export function BomReviewStep({ rows, onRowsChange, variant = 'create' }: BomReviewStepProps) {
  const { t: tRaw } = useTranslation('boms');
  const t = tRaw as TFn;
  const [openMatchRow, setOpenMatchRow] = useState<number | null>(null);
  const [createMaterialRow, setCreateMaterialRow] = useState<number | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['materials', 'categories'],
    queryFn: () => getMaterialCategories(),
  });

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
      // Confirming a scored suggestion keeps its score; a fresh pick is the
      // human's call ("Manual").
      matchConfidence: candidate?.confidence ?? null,
      uom: firstNonEmpty(rows[index].uom, material.unit),
      // A manual pick is authoritative about the material, so its catalogue
      // category / type replace any values carried from the prior suggestion;
      // fall back to the existing value only when the picked material lacks one.
      category: firstNonEmpty(material.category, rows[index].category),
      materialType: firstNonEmpty(material.subCategory, rows[index].materialType),
      manuallyResolved: true,
    });
    setOpenMatchRow(null);
  };

  const unmatched = unmatchedCount(rows);

  const th =
    'px-3 py-3 text-left text-xs font-bold leading-4 tracking-[0.6px] whitespace-nowrap text-[hsl(var(--table-header-foreground))]';
  const td = 'px-1 py-1 border-t border-border align-middle';

  const uomOptionsFor = (value: string) => {
    const base = UOM_OPTIONS.map((o) => ({ value: o.value as string, label: o.label as string }));
    if (value && !base.some((o) => o.value === value)) base.unshift({ value, label: value });
    return base;
  };

  const categoryOptionsFor = (value: string) => {
    const base = categories.map((c) => ({ value: c.name, label: c.name }));
    if (value && !base.some((o) => o.value === value)) base.unshift({ value, label: value });
    return base;
  };

  return (
    <div className="space-y-6" data-testid="bom-review-step">
      {variant === 'create' && unmatched > 0 && (
        <Alert variant="destructive" icon={<InfoIcon className="w-[18px] h-[18px]" />}>
          {t('create.unmatchedAlert')}
        </Alert>
      )}

      <div className="bg-card border border-border rounded-lg overflow-visible">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full min-w-[1180px] text-sm" data-testid="bom-review-table">
            <thead>
              <tr className="bg-[hsl(var(--table-header))]">
                <th className={cn(th, 'w-[22%]')}>{t('create.columns.materialName')}</th>
                <th className={cn(th, 'w-[13%]')}>{t('create.columns.match')}</th>
                <th className={cn(th, 'w-[15%]')}>{t('create.columns.description')}</th>
                <th className={cn(th, 'w-[8%]')}>{t('create.columns.uom')}</th>
                <th className={cn(th, 'w-[10%]')}>{t('create.columns.quantity')}</th>
                <th className={cn(th, 'w-[10%]')}>{t('create.columns.category')}</th>
                <th className={cn(th, 'w-[8%]')}>{t('create.columns.materialType')}</th>
                <th className={cn(th, 'w-[8%]')}>{t('create.columns.confidence')}</th>
                <th className={cn(th, 'w-[6%]')}>{t('create.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const badge = confidenceBadge(row, t);
                const empty = isRowEmpty(row);
                return (
                  <tr
                    key={index}
                    className={variant === 'edit' ? undefined : rowTint(row)}
                    data-testid={`bom-review-row-${index}`}
                  >
                    <td className={td}>
                      <Input
                        aria-label={t('create.columns.materialName')}
                        value={row.materialName}
                        placeholder={t('create.enterPlaceholder')}
                        onChange={(e) => updateRow(index, { materialName: e.target.value })}
                        className={NAKED_INPUT_CLASS}
                      />
                    </td>
                    <td className={cn(td, 'relative')}>
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
                        t={t}
                      />
                    </td>
                    <td className={td}>
                      <Input
                        aria-label={t('create.columns.description')}
                        value={row.description}
                        placeholder={t('create.enterPlaceholder')}
                        onChange={(e) => updateRow(index, { description: e.target.value })}
                        className={NAKED_INPUT_CLASS}
                      />
                    </td>
                    <td className={td}>
                      <CustomDropdown
                        options={uomOptionsFor(row.uom)}
                        value={row.uom}
                        onChange={(value) => updateRow(index, { uom: value })}
                        placeholder="UoM"
                        borderless
                      />
                    </td>
                    <td className={td}>
                      <div className="flex items-center gap-1 pr-1">
                        <Input
                          aria-label={t('create.columns.quantity')}
                          inputMode="decimal"
                          onKeyDown={onDecimalOnly}
                          value={row.quantity}
                          placeholder={empty ? t('create.enterPlaceholder') : '0'}
                          onChange={(e) => updateRow(index, { quantity: e.target.value })}
                          className={NAKED_INPUT_CLASS}
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
                    </td>
                    <td className={td}>
                      <CustomDropdown
                        options={categoryOptionsFor(row.category)}
                        value={row.category}
                        onChange={(value) => updateRow(index, { category: value })}
                        placeholder="—"
                        searchable
                        borderless
                      />
                    </td>
                    <td className={td}>
                      <Input
                        aria-label={t('create.columns.materialType')}
                        value={row.materialType}
                        placeholder="—"
                        onChange={(e) => updateRow(index, { materialType: e.target.value })}
                        className={NAKED_INPUT_CLASS}
                      />
                    </td>
                    <td className={cn(td, 'px-3')}>
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <Badge className="bg-[#E8EAED] text-[#2D3139]">{badge.label}</Badge>
                        {badge.pct && <span className="text-sm text-foreground">{badge.pct}</span>}
                      </span>
                    </td>
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
        </div>
      </div>

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
