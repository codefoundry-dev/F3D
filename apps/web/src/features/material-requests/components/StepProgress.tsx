import { cn } from '@forethread/ui-components';
import CheckmarkIcon from '@forethread/ui-components/assets/icons/checkmark.svg?react';
import { Fragment } from 'react';

/**
 * Horizontal wizard stepper for the "Raise a Material Request" flow, matching
 * the design system stepper used by the material-catalogue wizards (node
 * 6545:256118): one labelled badge per step with dashed connectors. A completed
 * step turns Success-green with a check, the active step is Cyan, future steps
 * are neutral. Labels collapse on phones so the badges still fit.
 */
export interface StepProgressProps {
  /** Ordered step labels. */
  steps: string[];
  /** 1-based index of the active step. */
  current: number;
}

type StepState = 'complete' | 'active' | 'future';

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

export function StepProgress({ steps, current }: StepProgressProps) {
  return (
    <div
      className="mb-6 flex w-full items-center overflow-x-auto rounded-[18px] border border-[#e8eaed] bg-[#f9f9fa] p-2"
      aria-label="Progress"
    >
      {steps.map((label, i) => {
        const n = i + 1;
        const state: StepState = n < current ? 'complete' : n === current ? 'active' : 'future';
        return (
          <Fragment key={label}>
            <div
              aria-current={state === 'active' ? 'step' : undefined}
              data-state={state}
              data-testid={`mr-wizard-step-${n}`}
              className={cn(
                'flex shrink-0 items-center gap-2.5 rounded-[12px] px-3 py-1.5 text-left',
                state === 'active' &&
                  'bg-white shadow-[0px_1px_2px_0px_rgba(10,13,18,0.06),0px_1px_3px_0px_rgba(10,13,18,0.04)]',
              )}
            >
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-[10px] border text-[13px] font-semibold [&_svg]:size-4',
                  badgeStyles[state],
                )}
              >
                {state === 'complete' ? <CheckmarkIcon /> : n}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-[14px] font-semibold leading-[1.4] tracking-[0.3px]',
                  labelStyles[state],
                  // Hide the inactive labels on phones; the active one stays so
                  // the user always sees where they are.
                  state === 'active' ? 'inline' : 'hidden sm:inline',
                )}
              >
                {label}
              </span>
            </div>

            {i < steps.length - 1 && (
              <div
                aria-hidden
                className="mx-2 h-0.5 min-w-[16px] flex-1 bg-[length:12px_2px] bg-repeat-x bg-[linear-gradient(to_right,#d2d5db_50%,transparent_50%)]"
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
