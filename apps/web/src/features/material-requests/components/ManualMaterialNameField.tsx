import type { MaterialSuggestionDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { useDebounce } from '@forethread/ui-components';
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { useMrMaterialSuggestionGroups } from '../services/material-requests.service';

import { MaterialThumb } from './MaterialThumb';

export interface ManualMaterialNameFieldProps {
  value: string;
  /** Free-text edit — the caller drops any previously linked materialId. */
  onValueChange: (value: string) => void;
  /** Pick from the catalogue popup — links the row to the material. */
  onSelectMaterial: (material: MaterialSuggestionDto) => void;
  /** Enter pressed in the field (the draft row commits on Enter). */
  onEnter?: () => void;
  placeholder: string;
  invalid?: boolean;
  className?: string;
  testId?: string;
  /** Shown before the input — the linked material's image on a committed row. */
  leading?: ReactNode;
}

/** Popup width on desktop; clamped to the viewport on small screens. */
const POPUP_WIDTH = 420;
/** Minimum room below the input before the popup flips above it. */
const POPUP_FLIP_HEIGHT = 280;

function SuggestionRow({
  material,
  onPick,
}: {
  material: MaterialSuggestionDto;
  onPick: (material: MaterialSuggestionDto) => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={false}
      onMouseDown={(e) => {
        // Fire before the input's blur so the pick wins over the close.
        e.preventDefault();
        onPick(material);
      }}
      className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-muted/50"
      data-testid={`mr-manual-suggestion-${material.id}`}
    >
      <MaterialThumb url={material.imageUrl} alt={material.name} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground" title={material.name}>
            {material.name}
          </span>
          {material.categoryName && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
              {material.categoryName}
            </span>
          )}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {material.uom?.trim() ? material.uom : 'Each'}
          {material.description ? ` · ${material.description}` : ''}
        </span>
      </span>
    </button>
  );
}

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
 * Material-name field for the Manual tab's inline line-item entry: free text
 * with a catalogue-search popup anchored beneath it, mirroring the RFQ manual
 * row (FOR-274). Picking a suggestion links the row to that catalogue material
 * so the request is raised against the real material rather than a loose name.
 *
 * The popup renders through a portal (and re-anchors on scroll/resize) so it is
 * never clipped by the surrounding scroll containers, and its width is clamped
 * to the viewport so it stays usable on a phone.
 */
export function ManualMaterialNameField({
  value,
  onValueChange,
  onSelectMaterial,
  onEnter,
  placeholder,
  invalid,
  className,
  testId,
  leading,
}: ManualMaterialNameFieldProps) {
  const { t } = useTranslation('materialRequests');
  const [open, setOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({});
  const anchorRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const term = useDebounce(value.trim(), 250);
  const shown = open && term.length > 0;
  const suggestionsQuery = useMrMaterialSuggestionGroups(shown ? term : '');

  // Keep the fixed-position popup glued to the input across scroll and resize.
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

  const field = (
    <div ref={anchorRef} className="relative min-w-0 flex-1">
      <input
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            return;
          }
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault();
            setOpen(false);
            onEnter();
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={shown}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-invalid={invalid ? true : undefined}
        className={
          className ??
          'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-foreground/50 md:h-9'
        }
        data-testid={testId}
      />
      {shown &&
        createPortal(
          <div
            id={listboxId}
            style={popupStyle}
            role="listbox"
            aria-label={t('requestMaterials.suggestionsLabel')}
            className="z-[9999] rounded-xl border border-border bg-card shadow-lg"
            data-testid="mr-manual-suggestions"
          >
            <div className="max-h-[280px] space-y-2 overflow-y-auto p-2">
              {suggestionsQuery.isLoading && results.length === 0 ? (
                <p role="status" className="px-1 py-4 text-center text-sm text-muted-foreground">
                  {t('requestMaterials.suggestionsLoading')}
                </p>
              ) : !hasAnyContent ? (
                <p className="px-1 py-4 text-center text-sm text-muted-foreground">
                  {t('requestMaterials.suggestionsEmpty', { query: term })}
                </p>
              ) : (
                <>
                  <Group rows={results} onPick={pick} testId="mr-manual-group-results" />
                  <Group
                    label={t('requestMaterials.suggestionsFrequent')}
                    rows={frequentlyUsed}
                    onPick={pick}
                    testId="mr-manual-group-frequent"
                  />
                  <Group
                    label={t('requestMaterials.suggestionsRecent')}
                    rows={recentlyUsed}
                    onPick={pick}
                    testId="mr-manual-group-recent"
                  />
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );

  if (!leading) return field;
  return (
    <div className="flex min-w-0 items-center gap-2">
      {leading}
      {field}
    </div>
  );
}
