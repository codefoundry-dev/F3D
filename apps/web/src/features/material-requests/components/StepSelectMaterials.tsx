import { useTranslation } from '@forethread/i18n';
import { useDebounce } from '@forethread/ui-components';
import CheckmarkIcon from '@forethread/ui-components/assets/icons/checkmark.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import PlusIcon from '@forethread/ui-components/assets/icons/plus.svg?react';
import SearchIcon from '@forethread/ui-components/assets/icons/search.svg?react';
import { useMemo, useState } from 'react';

import {
  useMrMaterialSuggestions,
  useMrProjectBoms,
  useMrBomDetail,
} from '../services/material-requests.service';
import { nextLineKey, type MrWizardLine } from '../wizard/wizard-types';

import { ManualLineItems } from './ManualLineItems';
import { NewMaterialModal, type NewMaterialDraft } from './NewMaterialModal';

type SourceTab = 'BOM' | 'CATALOG' | 'MANUAL';

export interface StepSelectMaterialsProps {
  projectId: string;
  lines: MrWizardLine[];
  /** Toggle a catalogue/BOM line in or out of the selection. */
  onToggleLine: (line: MrWizardLine) => void;
  /** Add a free-text manual line. */
  onAddManual: (draft: NewMaterialDraft) => void;
  /** Remove a single manual line by key. */
  onRemoveLine: (key: string) => void;
  /** Inline edit of an already-added line (manual rows stay editable). */
  onPatchLine: (key: string, patch: Partial<MrWizardLine>) => void;
  /** Whether the Manual tab's blank row is complete and about to become a line. */
  onManualDraftReadyChange?: (ready: boolean) => void;
}

/** A pickable catalogue/BOM row, normalised across the two data sources. */
interface PickRow {
  /** Stable identity for the picker (catalogue materialId or BOM item id). */
  pickId: string;
  materialId?: string;
  name: string;
  sku?: string;
  unit: string;
  description?: string;
  source: 'CATALOG' | 'BOM';
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 border-b-2 px-3 py-3 text-sm transition-colors ${
        active
          ? 'border-foreground font-medium text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function PickableRow({
  row,
  selected,
  onToggle,
}: {
  row: PickRow;
  selected: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation('materialRequests');
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent/50"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <PackageIcon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{row.name}</span>
        {row.sku ? (
          <span className="block truncate text-xs text-muted-foreground">
            {t('requestMaterials.skuLabel', { sku: row.sku })}
          </span>
        ) : (
          <span className="block truncate text-xs text-muted-foreground">
            {t('requestMaterials.unitLabel', { unit: row.unit })}
          </span>
        )}
      </span>
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded border ${
          selected ? 'border-foreground bg-foreground text-background' : 'border-border bg-card'
        }`}
      >
        {selected && <CheckmarkIcon className="size-3" />}
      </span>
    </button>
  );
}

/**
 * Step 1 — "Request Materials" (Figma 2002:176). Three source tabs:
 *   - BOM: the project's active bill of materials (checkbox multi-select).
 *   - Catalog: catalogue suggestions (debounced search, checkbox multi-select).
 *   - Manual: free-text lines added via the New Material modal.
 *
 * Renders inside the wizard's design-system card.
 */
export function StepSelectMaterials({
  projectId,
  lines,
  onToggleLine,
  onAddManual,
  onRemoveLine,
  onPatchLine,
  onManualDraftReadyChange,
}: StepSelectMaterialsProps) {
  const { t } = useTranslation('materialRequests');
  const [tab, setTab] = useState<SourceTab>('CATALOG');
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const suggestionsQuery = useMrMaterialSuggestions(tab === 'CATALOG' ? debouncedSearch : '');
  const bomsQuery = useMrProjectBoms(tab === 'BOM' ? projectId : undefined);
  const activeBomId = useMemo(() => {
    const boms = bomsQuery.data ?? [];
    return boms.find((b) => b.status === 'ACTIVE')?.id ?? boms[0]?.id;
  }, [bomsQuery.data]);
  const bomDetailQuery = useMrBomDetail(tab === 'BOM' ? activeBomId : undefined);

  const selectedMaterialIds = useMemo(
    () => new Set(lines.map((l) => l.materialId).filter(Boolean) as string[]),
    [lines],
  );

  const catalogRows: PickRow[] = useMemo(
    () =>
      (suggestionsQuery.data ?? []).map((m) => ({
        pickId: m.id,
        materialId: m.id,
        name: m.name,
        unit: m.uom ?? 'Each',
        description: m.description ?? undefined,
        source: 'CATALOG' as const,
      })),
    [suggestionsQuery.data],
  );

  const bomRows: PickRow[] = useMemo(() => {
    const items = bomDetailQuery.data?.items ?? [];
    const term = debouncedSearch.trim().toLowerCase();
    return items
      .filter((it) => !term || it.materialName.toLowerCase().includes(term))
      .map((it) => ({
        pickId: it.id,
        materialId: it.matchedMaterialId || undefined,
        name: it.materialName,
        unit: it.uom ?? 'Each',
        description: it.description ?? undefined,
        source: 'BOM' as const,
      }));
  }, [bomDetailQuery.data, debouncedSearch]);

  const handleToggle = (row: PickRow) => {
    // Find an existing selected line for this pick (by materialId when present).
    const existing = lines.find((l) =>
      row.materialId ? l.materialId === row.materialId : l.materialName === row.name,
    );
    if (existing) {
      onRemoveLine(existing.key);
      return;
    }
    onToggleLine({
      key: nextLineKey(),
      source: row.source,
      materialId: row.materialId,
      materialName: row.name,
      description: row.description,
      sku: row.sku,
      unit: row.unit,
      quantity: 0,
      priority: 'STANDARD',
    });
  };

  const isRowSelected = (row: PickRow) =>
    row.materialId
      ? selectedMaterialIds.has(row.materialId)
      : lines.some((l) => l.materialName === row.name);

  const manualLines = lines.filter((l) => l.source === 'MANUAL');

  return (
    <div className="flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-border px-2">
        <TabButton
          active={tab === 'BOM'}
          label={t('requestMaterials.tabBom')}
          onClick={() => setTab('BOM')}
        />
        <TabButton
          active={tab === 'CATALOG'}
          label={t('requestMaterials.tabCatalog')}
          onClick={() => setTab('CATALOG')}
        />
        <TabButton
          active={tab === 'MANUAL'}
          label={t('requestMaterials.tabManual')}
          onClick={() => setTab('MANUAL')}
        />
      </div>

      {/* Search (hidden on Manual tab) */}
      {tab !== 'MANUAL' && (
        <div className="px-4 pt-4">
          <label className="sr-only" htmlFor="mr-search">
            {t('requestMaterials.searchLabel')}
          </label>
          <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2.5">
            <SearchIcon className="size-4 text-muted-foreground" />
            <input
              id="mr-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                tab === 'BOM'
                  ? t('requestMaterials.searchBomPlaceholder')
                  : t('requestMaterials.searchCatalogPlaceholder')
              }
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}

      {/* Body */}
      <div className="py-3">
        {tab === 'CATALOG' && (
          <CatalogList rows={catalogRows} isSelected={isRowSelected} onToggle={handleToggle} />
        )}
        {tab === 'BOM' && (
          <BomList
            rows={bomRows}
            hasBom={!!activeBomId}
            isSelected={isRowSelected}
            onToggle={handleToggle}
          />
        )}
        {tab === 'MANUAL' && (
          <ManualTab
            lines={manualLines}
            onAddManual={onAddManual}
            onPatchLine={onPatchLine}
            onRemove={onRemoveLine}
            onDraftReadyChange={onManualDraftReadyChange}
            onOpenModal={() => setShowNewModal(true)}
          />
        )}
      </div>

      {showNewModal && (
        <NewMaterialModal
          onClose={() => setShowNewModal(false)}
          onAdd={(draft) => {
            onAddManual(draft);
            setShowNewModal(false);
          }}
        />
      )}
    </div>
  );
}

function CatalogList({
  rows,
  isSelected,
  onToggle,
}: {
  rows: PickRow[];
  isSelected: (row: PickRow) => boolean;
  onToggle: (row: PickRow) => void;
}) {
  const { t } = useTranslation('materialRequests');
  if (rows.length === 0) {
    return (
      <EmptyHint
        title={t('requestMaterials.noCatalogResults')}
        hint={t('requestMaterials.noCatalogResultsHint')}
      />
    );
  }
  return (
    <div data-testid="mr-catalog-list">
      {rows.map((row) => (
        <PickableRow
          key={row.pickId}
          row={row}
          selected={isSelected(row)}
          onToggle={() => onToggle(row)}
        />
      ))}
    </div>
  );
}

function BomList({
  rows,
  hasBom,
  isSelected,
  onToggle,
}: {
  rows: PickRow[];
  hasBom: boolean;
  isSelected: (row: PickRow) => boolean;
  onToggle: (row: PickRow) => void;
}) {
  const { t } = useTranslation('materialRequests');
  if (!hasBom) {
    return <EmptyHint title={t('requestMaterials.noBom')} hint={t('requestMaterials.noBomHint')} />;
  }
  if (rows.length === 0) {
    return (
      <EmptyHint
        title={t('requestMaterials.noCatalogResults')}
        hint={t('requestMaterials.noCatalogResultsHint')}
      />
    );
  }
  return (
    <div data-testid="mr-bom-list">
      {rows.map((row) => (
        <PickableRow
          key={row.pickId}
          row={row}
          selected={isSelected(row)}
          onToggle={() => onToggle(row)}
        />
      ))}
    </div>
  );
}

/**
 * Manual tab: inline line-item entry (the RFQ/PO "manually add a line item"
 * pattern) plus the full New Material form for the extras the inline row has no
 * room for (photo, long description).
 */
function ManualTab({
  lines,
  onAddManual,
  onPatchLine,
  onRemove,
  onDraftReadyChange,
  onOpenModal,
}: {
  lines: MrWizardLine[];
  onAddManual: (draft: NewMaterialDraft) => void;
  onPatchLine: (key: string, patch: Partial<MrWizardLine>) => void;
  onRemove: (key: string) => void;
  onDraftReadyChange?: (ready: boolean) => void;
  onOpenModal: () => void;
}) {
  const { t } = useTranslation('materialRequests');
  return (
    <div className="flex flex-col gap-4 px-4">
      <ManualLineItems
        lines={lines}
        onAdd={onAddManual}
        onPatch={onPatchLine}
        onRemove={onRemove}
        onDraftReadyChange={onDraftReadyChange}
      />

      <button
        type="button"
        onClick={onOpenModal}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-foreground py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent/50 sm:w-auto sm:self-start sm:px-4"
        data-testid="mr-manual-add"
      >
        <PlusIcon className="size-4" />
        {t('requestMaterials.addMaterialDetailed')}
      </button>
    </div>
  );
}

function EmptyHint({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-12 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
