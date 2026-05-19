import type { ReactNode } from 'react';

export interface DashboardSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
  /** Max height (px) for the scrollable content area */
  maxHeight?: number;
}

export function DashboardSection({ title, children, className, maxHeight }: DashboardSectionProps) {
  return (
    <div
      className={`bg-white rounded-[14px] border border-black/20 overflow-hidden flex flex-col ${className ?? ''}`}
    >
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-lg font-medium text-foreground">{title}</h2>
      </div>
      <div
        className="px-4 pb-4 pt-0.5 flex-1 overflow-y-auto space-y-2"
        style={maxHeight ? { maxHeight } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

export function DashboardSectionSkeleton({ title, count = 2 }: { title: string; count?: number }) {
  return (
    <DashboardSection title={title}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-[132px] animate-pulse rounded-lg bg-muted" />
      ))}
    </DashboardSection>
  );
}
