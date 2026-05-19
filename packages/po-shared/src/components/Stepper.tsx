import { StepCircle } from '@forethread/ui-components';

export function Stepper({ step, labels }: { step: number; labels: string[] }) {
  return (
    <div className="bg-background border border-border rounded-lg px-2 sm:px-4 py-2.5 flex items-center w-full overflow-x-auto">
      {labels.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum <= step;
        const isComplete = stepNum < step;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-initial min-w-0">
            <div className="flex flex-col items-center gap-2 w-[120px] sm:w-[200px] px-1 sm:px-3 shrink-0">
              <StepCircle number={stepNum} active={isActive} />
              <span className="text-xs sm:text-sm text-center leading-5 text-foreground truncate w-full">
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div
                className={`h-0.5 flex-1 min-w-[20px] ${isComplete ? 'bg-foreground' : 'bg-muted'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
