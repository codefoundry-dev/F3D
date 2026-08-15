import { Badge, EmptyState, Spinner, getStatusColor } from '@forethread/ui-components';
import type React from 'react';

export type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

const DATE_FORMAT: Intl.DateTimeFormatOptions = { month: 'short', day: '2-digit', year: 'numeric' };

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-US', DATE_FORMAT);
}

export function formatMoney(amount: number | null | undefined, currency: string): string {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(amount);
}

/** Fallback label for a status key with no i18n entry: PENDING_APPROVAL → "Pending approval". */
export function humanizeStatus(status: string): string {
  const words = status.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function StatusBadge({
  colorMap,
  status,
  label,
}: {
  colorMap: Record<string, string>;
  status: string;
  label: string;
}) {
  return <Badge className={getStatusColor(colorMap, status)}>{label}</Badge>;
}

export function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {count !== undefined && (
          <span className="text-xs font-semibold bg-muted text-muted-foreground rounded-full px-2 py-0.5">
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

export function SectionContent({
  isLoading,
  isError,
  isEmpty,
  errorText,
  emptyTitle,
  emptyDescription,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  errorText: string;
  emptyTitle: string;
  emptyDescription: string;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }
  if (isError) return <p className="text-sm text-destructive py-4">{errorText}</p>;
  if (isEmpty) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return <>{children}</>;
}

export function TableShell({
  minWidth = 760,
  children,
}: {
  minWidth?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto border border-border rounded-lg">
      <table className="w-full text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function HeadRow({ labels }: { labels: string[] }) {
  return (
    <thead>
      <tr className="bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))] text-left">
        {labels.map((label, i) => (
          <th
            key={`${label}-${i}`}
            className="px-4 py-3 text-xs font-bold leading-4 tracking-[0.6px] whitespace-nowrap"
          >
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** Footnote shown when useAllRows hit its safety cap and left rows unfetched. */
export function TruncationNote({
  shown,
  total,
  t,
}: {
  shown: number;
  total: number | undefined;
  t: TranslationFn;
}) {
  if (!total || total <= shown) return null;
  return (
    <p className="text-xs text-muted-foreground mt-2">
      {t('detail.showingFirst', { shown, total })}
    </p>
  );
}
