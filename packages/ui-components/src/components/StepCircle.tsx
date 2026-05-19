import { cn } from '../utils/cn';

export interface StepCircleProps {
  number: number;
  active?: boolean;
  className?: string;
}

export function StepCircle({ number, active = false, className }: StepCircleProps) {
  return (
    <div
      className={cn(
        'flex w-10 h-10 items-center justify-center rounded-full text-sm font-normal shrink-0',
        active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {number}
    </div>
  );
}
