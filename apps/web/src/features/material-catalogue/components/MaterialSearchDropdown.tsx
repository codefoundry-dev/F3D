import { type MaterialSuggestionDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import { type ReactNode } from 'react';

export interface MaterialSearchDropdownProps {
  /** The committed (debounced) query the dropdown is showing results for. */
  query: string;
  /** Direct suggestion matches for the query ("results" group). */
  results: MaterialSuggestionDto[];
  /** Total match count for the header line (falls back to results.length). */
  resultCount?: number;
  /** Materials surfaced as "Frequently used" (group hidden when empty). */
  frequentlyUsed: MaterialSuggestionDto[];
  /** Materials the user recently opened ("Recently used", hidden when empty). */
  recentlyUsed: MaterialSuggestionDto[];
  isLoading: boolean;
  /** Preview a material (eye / row click) — also records it as recently used. */
  onSelect: (material: { id: string; name: string }) => void;
}

type SearchRow = MaterialSuggestionDto;

/** Small square material thumbnail — image when present, else a box glyph. */
function Thumb({ url, alt }: { url?: string | null; alt: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt={alt}
        className="w-12 h-12 rounded-lg object-cover border border-border flex-shrink-0"
      />
    );
  }
  return (
    <span
      className="flex items-center justify-center w-12 h-12 rounded-lg bg-muted text-muted-foreground flex-shrink-0"
      aria-hidden="true"
    >
      <PackageIcon className="w-5 h-5" />
    </span>
  );
}

/** A single result row (thumb, name + category chip, uom, description, eye). */
function ResultRow({
  material,
  onSelect,
}: {
  material: SearchRow;
  onSelect: (material: { id: string; name: string }) => void;
}) {
  const { t } = useTranslation(['materialCatalogue']);
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        // Fire before the input's blur so the dropdown stays open through the click.
        e.preventDefault();
        onSelect({ id: material.id, name: material.name });
      }}
      className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card text-left hover:bg-muted/40 transition-colors"
      data-testid={`material-search-result-${material.id}`}
    >
      <Thumb url={material.imageUrl} alt={material.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate" title={material.name}>
            {material.name}
          </span>
          {material.categoryName && (
            <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-xs text-foreground">
              {material.categoryName}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {material.uom?.trim() ? material.uom : t('search.unitOfMeasuresFallback')}
        </p>
        {material.description && (
          <p className="text-xs text-muted-foreground truncate">{material.description}</p>
        )}
      </div>
      <span
        className="flex-shrink-0 text-muted-foreground"
        aria-label={t('actions.view')}
        data-testid={`material-search-view-${material.id}`}
      >
        <EyeIcon className="w-5 h-5" />
      </span>
    </button>
  );
}

/** A labelled group ("Frequently used" / "Recently used"), rendered only when filled. */
function Group({
  label,
  rows,
  onSelect,
  testId,
}: {
  label?: ReactNode;
  rows: SearchRow[];
  onSelect: (material: { id: string; name: string }) => void;
  testId: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2" data-testid={testId}>
      {label && <p className="text-sm font-semibold text-muted-foreground">{label}</p>}
      <div className="space-y-2">
        {rows.map((material) => (
          <ResultRow key={`${testId}-${material.id}`} material={material} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

/**
 * Search autocomplete dropdown for the catalogue (US 4.04). Anchored below the
 * search input, it shows a result-count header then up to three groups —
 * direct results, "Frequently used", and "Recently used" — each only when it
 * has items. Matches Figma node 6240:149439.
 */
export function MaterialSearchDropdown({
  query,
  results,
  resultCount,
  frequentlyUsed,
  recentlyUsed,
  isLoading,
  onSelect,
}: MaterialSearchDropdownProps) {
  const { t } = useTranslation(['materialCatalogue']);

  const count = resultCount ?? results.length;
  const hasAnyContent = results.length > 0 || frequentlyUsed.length > 0 || recentlyUsed.length > 0;

  return (
    <div
      className="absolute left-0 top-full z-30 mt-2 w-[min(620px,calc(100vw-4rem))] rounded-xl border border-border bg-card shadow-lg"
      role="listbox"
      aria-label={t('search.dropdownLabel')}
      data-testid="material-search-dropdown"
    >
      <div className="max-h-[420px] overflow-y-auto p-2 space-y-3">
        <p className="px-1 pt-1 text-sm text-muted-foreground" data-testid="material-search-count">
          {t('search.resultCount', { count })}
        </p>

        {isLoading && results.length === 0 ? (
          <p role="status" className="px-1 py-6 text-center text-sm text-muted-foreground">
            {t('search.loading')}
          </p>
        ) : !hasAnyContent ? (
          <p className="px-1 py-6 text-center text-sm text-muted-foreground">
            {t('search.noSuggestions', { query })}
          </p>
        ) : (
          <>
            <Group rows={results} onSelect={onSelect} testId="material-search-group-results" />
            <Group
              label={t('search.frequentlyUsed')}
              rows={frequentlyUsed}
              onSelect={onSelect}
              testId="material-search-group-frequent"
            />
            <Group
              label={t('search.recentlyUsed')}
              rows={recentlyUsed}
              onSelect={onSelect}
              testId="material-search-group-recent"
            />
          </>
        )}
      </div>
    </div>
  );
}
