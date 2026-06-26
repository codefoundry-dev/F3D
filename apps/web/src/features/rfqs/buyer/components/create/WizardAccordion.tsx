import { cn } from '@forethread/ui-components';
import ChevronDownIcon from '@forethread/ui-components/assets/icons/chevron-down.svg?react';
import { useState, type ReactNode } from 'react';

interface WizardAccordionProps {
  title: string;
  subtitle?: string;
  /** Right-aligned summary (e.g. selected count) shown in the header. */
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  testId?: string;
}

/**
 * Collapsible card section used to stack the Select-Vendors and Add-Line-Items
 * blocks on the consolidated first step of the Create-RFQ flow. Chrome (card
 * border + clickable title/subtitle header) lives here so the inner blocks stay
 * presentational.
 */
export function WizardAccordion({
  title,
  subtitle,
  summary,
  defaultOpen = true,
  children,
  testId,
}: WizardAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="bg-card rounded-lg border border-border" data-testid={testId}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left"
        data-testid={testId ? `${testId}-toggle` : undefined}
      >
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground leading-[22px]">{title}</h2>
          {subtitle && <p className="text-[13px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {summary}
          <ChevronDownIcon
            className={cn(
              'w-5 h-5 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </div>
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </section>
  );
}
