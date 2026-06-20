import { useTranslation } from '@forethread/i18n';

export interface MaterialNoResultsProps {
  /** The active search term, echoed back in the message. */
  query: string;
}

/** Open-box + magnifier illustration matching the Figma "No results" empty state. */
function NoResultsIllustration() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      className="text-muted-foreground/60"
      aria-hidden="true"
    >
      {/* Open box: two front flaps + the box body. */}
      <path
        d="M24 58 L60 70 L96 58 L60 46 Z"
        fill="currentColor"
        opacity="0.25"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M24 58 L24 86 L60 100 L60 70 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M96 58 L96 86 L60 100 L60 70 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Magnifying glass rising out of the box. */}
      <circle cx="62" cy="40" r="14" fill="white" stroke="currentColor" strokeWidth="2.5" />
      <line
        x1="72"
        y1="50"
        x2="82"
        y2="60"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Centered "No results found" empty state for a committed catalogue search that
 * returns zero rows (US 4.04). Matches Figma node 6240:150674 — illustration,
 * heading, and a query-aware message.
 */
export function MaterialNoResults({ query }: MaterialNoResultsProps) {
  const { t } = useTranslation(['materialCatalogue']);
  return (
    <div
      className="flex flex-col items-center justify-center px-6 py-16 text-center"
      data-testid="material-no-results"
    >
      <NoResultsIllustration />
      <h3 className="mt-4 text-xl font-semibold text-foreground">{t('search.noResultsTitle')}</h3>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        {t('search.noResultsBody', { query })}
      </p>
    </div>
  );
}
