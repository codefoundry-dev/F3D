import { cn } from '../utils/cn';

export interface CompactStepperProps {
  /** 1-based index of the active step. */
  current: number;
  total: number;
  /** The active step's label, e.g. "Add line items". */
  label: string;
  /** "Step {{current}} of {{total}}" prefix; override for translations. */
  stepOfLabel?: string;
  className?: string;
}

/**
 * Phone wizard progress (ADR-0019 B8, FOR-374): one line reading
 * "Step 2 of 3 · Add line items" over a thin progress bar. The full labelled
 * steppers swap to this below 768px, since their pills overflow on phones.
 */
export function CompactStepper({
  current,
  total,
  label,
  stepOfLabel,
  className,
}: CompactStepperProps) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;
  return (
    <div className={cn('flex w-full flex-col gap-2', className)} data-testid="compact-stepper">
      <p className="truncate text-[14px] font-semibold leading-[1.4] text-[#2d3139]">
        <span className="text-[#717784]">{stepOfLabel ?? `Step ${current} of ${total}`}</span>
        <span aria-hidden className="text-[#717784]">
          {' · '}
        </span>
        {label}
      </p>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-label={label}
        className="h-1 w-full overflow-hidden rounded-full bg-[#e8eaed]"
      >
        <div
          className="h-full rounded-full bg-[#088ab2] transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
