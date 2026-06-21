import { cn } from '@forethread/ui-components';
import { Fragment, type ReactNode } from 'react';

export interface WizardStepperStep {
  /** Full segment label, e.g. "Step 1/3: Enter mandatory information". */
  label: string;
  /** Per-step glyph rendered inside the badge; recoloured by state. */
  icon: ReactNode;
}

export interface WizardStepperProps {
  steps: WizardStepperStep[];
  /** 1-based index of the active step. */
  current: number;
  /** Fired when a completed step is clicked (jump back). */
  onStepSelect?: (step: number) => void;
  /** Tooltip on completed steps (e.g. "Back to step"). */
  backLabel?: string;
}

type StepState = 'complete' | 'active' | 'future';

/* Badge surface per state — Figma "Stepper" (node 6545:256118). The completed
   step keeps its own glyph but turns Success-green; the active step is Cyan; a
   future step is a neutral white badge. */
const badgeStyles: Record<StepState, string> = {
  complete: 'border-[#aaf0c4] bg-gradient-to-b from-[#d3f8df] to-[#f6fef9] text-[#099250]',
  active: 'border-[#a5f0fc] bg-gradient-to-b from-[#cff9fe] to-[#f5feff] text-[#088ab2]',
  future: 'border-[#e8eaed] bg-gradient-to-b from-[#f9f9fa] to-white text-[#525866]',
};

const labelStyles: Record<StepState, string> = {
  complete: 'text-[#099250]',
  active: 'text-[#2d3139]',
  future: 'text-[#717784]',
};

/**
 * Horizontal wizard progress bar shared by the material create + upload flows.
 * Renders one labelled badge per step with dashed connectors between them.
 * Completed steps are clickable to jump back; the active and future steps are
 * inert. Matches Figma node 6545:256118.
 */
export function WizardStepper({ steps, current, onStepSelect, backLabel }: WizardStepperProps) {
  return (
    <div
      className="flex w-full items-center overflow-x-auto rounded-[18px] border border-[#e8eaed] bg-[#f9f9fa] p-2"
      aria-label="Progress"
    >
      {steps.map((step, i) => {
        const n = i + 1;
        const state: StepState = n < current ? 'complete' : n === current ? 'active' : 'future';
        const clickable = state === 'complete' && Boolean(onStepSelect);
        const Tag = clickable ? 'button' : 'div';

        return (
          <Fragment key={i}>
            <Tag
              {...(clickable
                ? { type: 'button' as const, onClick: () => onStepSelect?.(n), title: backLabel }
                : {})}
              aria-current={state === 'active' ? 'step' : undefined}
              data-testid={`wizard-step-${n}`}
              data-state={state}
              className={cn(
                'flex shrink-0 items-center gap-2.5 rounded-[12px] px-3 py-1.5 text-left',
                state === 'active' &&
                  'bg-white shadow-[0px_1px_2px_0px_rgba(10,13,18,0.06),0px_1px_3px_0px_rgba(10,13,18,0.04)]',
                clickable && 'transition-colors hover:bg-white/70',
              )}
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-[10px] border [&_svg]:size-[18px]',
                  badgeStyles[state],
                )}
              >
                {step.icon}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-[14px] font-semibold leading-[1.4] tracking-[0.3px]',
                  labelStyles[state],
                )}
              >
                {step.label}
              </span>
            </Tag>

            {i < steps.length - 1 && (
              <div
                aria-hidden
                className="mx-2 h-0.5 min-w-[20px] flex-1 bg-[length:12px_2px] bg-repeat-x bg-[linear-gradient(to_right,#d2d5db_50%,transparent_50%)]"
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
