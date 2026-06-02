interface StepIndicatorProps {
  steps: string[];
  current: number;
  furthestReached: number;
  onStepClick: (index: number) => void;
}

export function StepIndicator({
  steps,
  current,
  furthestReached,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <nav aria-label="RFQ creation steps">
      <ol className="flex items-center gap-2">
        {steps.map((label, index) => {
          const isActive = index === current;
          const isReachable = index <= furthestReached;
          const isComplete = index < furthestReached;

          return (
            <li key={label} className="flex items-center gap-2">
              <button
                type="button"
                disabled={!isReachable}
                aria-current={isActive ? 'step' : undefined}
                onClick={() => isReachable && onStepClick(index)}
                className={[
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isReachable
                      ? 'text-foreground hover:bg-accent'
                      : 'text-muted-foreground cursor-not-allowed',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium',
                    isActive
                      ? 'border-primary-foreground'
                      : isComplete
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border',
                  ].join(' ')}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
              {index < steps.length - 1 && (
                <span className="h-px w-4 bg-border" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
