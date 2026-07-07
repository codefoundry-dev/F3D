import { type MaterialSuggestionDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { useDebounce } from '@forethread/ui-components';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

import { useRfqMaterialSuggestions } from '../../services/rfqs.service';

export interface ManualMaterialNameCellProps {
  value: string;
  /** Free-text edit — the parent drops any previously linked materialId. */
  onValueChange: (value: string) => void;
  /** Pick from the catalogue popup — links the draft row to the material. */
  onSelectMaterial: (material: MaterialSuggestionDto) => void;
  /** Commit the draft row on blur, matching the sibling manual cells. */
  onCommit: () => void;
  placeholder: string;
  testId?: string;
}

/** Popup width; the table cell is too narrow to bound the results legibly. */
const POPUP_WIDTH = 480;
/** Minimum room below the input before the popup flips above it. */
const POPUP_FLIP_HEIGHT = 320;

/** Small square material thumbnail — image when present, else a box glyph. */
function Thumb({ url, alt }: { url?: string | null; alt: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt={alt}
        className="w-9 h-9 rounded-lg object-cover border border-border flex-shrink-0"
      />
    );
  }
  return (
    <span
      className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted text-muted-foreground flex-shrink-0"
      aria-hidden="true"
    >
      <PackageIcon className="w-4 h-4" />
    </span>
  );
}

/** One suggestion row — a compact version of the catalogue dropdown's row. */
function SuggestionRow({
  material,
  onPick,
}: {
  material: MaterialSuggestionDto;
  onPick: (material: MaterialSuggestionDto) => void;
}) {
  const { t } = useTranslation(['materialCatalogue']);
  const uom = material.uom?.trim() ? material.uom : t('search.unitOfMeasuresFallback');
  return (
    <button
      type="button"
      role="option"
      aria-selected={false}
      onMouseDown={(e) => {
        // Fire before the input's blur so the pick wins over the blur-commit.
        e.preventDefault();
        onPick(material);
      }}
      className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left hover:bg-muted/40 transition-colors"
      data-testid={`material-name-suggestion-${material.id}`}
    >
      <Thumb url={material.imageUrl} alt={material.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate" title={material.name}>
            {material.name}
          </span>
          {material.categoryName && (
            <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-xs text-foreground">
              {material.categoryName}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {uom}
          {material.description ? ` · ${material.description}` : ''}
        </p>
      </div>
    </button>
  );
}

/** A labelled group ("Frequently used" / "Recently used"), hidden when empty. */
function Group({
  label,
  rows,
  onPick,
  testId,
}: {
  label?: string;
  rows: MaterialSuggestionDto[];
  onPick: (material: MaterialSuggestionDto) => void;
  testId: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1" data-testid={testId}>
      {label && <p className="px-1 text-xs font-semibold text-muted-foreground">{label}</p>}
      {rows.map((material) => (
        <SuggestionRow key={`${testId}-${material.id}`} material={material} onPick={onPick} />
      ))}
    </div>
  );
}

/**
 * Manual line-item "Material Name" cell (FOR-274): a free-text input with a
 * catalogue-search popup anchored beneath it. Typing queries the same
 * suggestions endpoint as the catalogue page's dropdown (US 4.04) and picking
 * a result links the draft row to the material. The popup renders through a
 * portal because the line-items table scrolls (`overflow-x-auto`) and would
 * clip an absolutely-positioned child.
 */
export function ManualMaterialNameCell({
  value,
  onValueChange,
  onSelectMaterial,
  onCommit,
  placeholder,
  testId,
}: ManualMaterialNameCellProps) {
  const { t } = useTranslation(['materialCatalogue']);
  const [open, setOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({});
  const anchorRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const term = useDebounce(value.trim(), 250);
  const shown = open && term.length > 0;
  // Only fetch while the popup is showing, mirroring the catalogue page.
  const suggestionsQuery = useRfqMaterialSuggestions(shown ? term : '');

  // Keep the fixed-position popup glued to the input across page/table scroll
  // and resize while it is open.
  useLayoutEffect(() => {
    if (!shown) return;
    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(POPUP_WIDTH, window.innerWidth - 32);
      const openUp =
        window.innerHeight - rect.bottom < POPUP_FLIP_HEIGHT &&
        rect.top > window.innerHeight - rect.bottom;
      setPopupStyle({
        position: 'fixed',
        left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)),
        width,
        ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      });
    };
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [shown]);

  const pick = (material: MaterialSuggestionDto) => {
    onSelectMaterial(material);
    setOpen(false);
  };

  const results = suggestionsQuery.data?.results ?? [];
  const frequentlyUsed = suggestionsQuery.data?.frequentlyUsed ?? [];
  const recentlyUsed = suggestionsQuery.data?.recentlyUsed ?? [];
  const hasAnyContent = results.length > 0 || frequentlyUsed.length > 0 || recentlyUsed.length > 0;

  return (
    <div ref={anchorRef} className="relative">
      <input
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          onCommit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={shown}
        aria-controls={listboxId}
        aria-autocomplete="list"
        className="w-full h-9 px-2 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:bg-muted/40 rounded"
        data-testid={testId}
      />
      {shown &&
        createPortal(
          <div
            id={listboxId}
            style={popupStyle}
            role="listbox"
            aria-label={t('search.dropdownLabel')}
            className="z-[9999] rounded-xl border border-border bg-card shadow-lg"
            data-testid="material-name-dropdown"
          >
            <div className="max-h-[320px] overflow-y-auto p-2 space-y-2">
              <p className="px-1 pt-1 text-xs text-muted-foreground">
                {t('search.resultCount', { count: results.length })}
              </p>

              {suggestionsQuery.isLoading && results.length === 0 ? (
                <p role="status" className="px-1 py-4 text-center text-sm text-muted-foreground">
                  {t('search.loading')}
                </p>
              ) : !hasAnyContent ? (
                <p className="px-1 py-4 text-center text-sm text-muted-foreground">
                  {t('search.noSuggestions', { query: term })}
                </p>
              ) : (
                <>
                  <Group rows={results} onPick={pick} testId="material-name-group-results" />
                  <Group
                    label={t('search.frequentlyUsed')}
                    rows={frequentlyUsed}
                    onPick={pick}
                    testId="material-name-group-frequent"
                  />
                  <Group
                    label={t('search.recentlyUsed')}
                    rows={recentlyUsed}
                    onPick={pick}
                    testId="material-name-group-recent"
                  />
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
