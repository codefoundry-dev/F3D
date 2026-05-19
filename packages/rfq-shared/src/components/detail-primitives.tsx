// Re-export from ui-components to avoid duplication
export { formatDate, formatCurrency } from '@forethread/ui-components';

export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground font-medium text-right max-w-[55%] break-words">
        {value ?? '-'}
      </span>
    </div>
  );
}

/** Stacked field for panel layout: label on top, value below */
export function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 justify-center">
      <span className="text-sm leading-3.5 text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value ?? '-'}</span>
    </div>
  );
}

export function SectionDivider() {
  return <div className="border-b border-foreground/10 my-4" />;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-medium text-foreground mb-2">{children}</h3>;
}
