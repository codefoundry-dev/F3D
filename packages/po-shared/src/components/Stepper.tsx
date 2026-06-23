import { cn } from '@forethread/ui-components';
import { Fragment } from 'react';

type StepState = 'complete' | 'active' | 'future';

/* Badge surface per state — mirrors the super-admin "WizardStepper" (Figma node
   6545:256118): a completed step turns Success-green, the active step is Cyan,
   and a future step is a neutral white badge. */
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
 * Horizontal wizard progress bar shared by the PO, RFQ, Project, and BOM create
 * flows. Mirrors the super-admin material-catalogue WizardStepper (Figma node
 * 6545:256118): one labelled pill per step with a numbered badge and dashed
 * connectors between. `step` is the 1-based index of the active step.
 */
export function Stepper({ step, labels }: { step: number; labels: string[] }) {
  return (
    <div
      className="flex w-full items-center overflow-x-auto rounded-[18px] border border-[#e8eaed] bg-[#f9f9fa] p-2"
      aria-label="Progress"
    >
      {labels.map((label, i) => {
        const n = i + 1;
        const state: StepState = n < step ? 'complete' : n === step ? 'active' : 'future';
        return (
          <Fragment key={i}>
            <div
              aria-current={state === 'active' ? 'step' : undefined}
              data-testid={`wizard-step-${n}`}
              data-state={state}
              className={cn(
                'flex shrink-0 items-center gap-2.5 rounded-[12px] px-3 py-1.5 text-left',
                state === 'active' &&
                  'bg-white shadow-[0px_1px_2px_0px_rgba(10,13,18,0.06),0px_1px_3px_0px_rgba(10,13,18,0.04)]',
              )}
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-[10px] border text-[14px] font-semibold',
                  badgeStyles[state],
                )}
              >
                {n}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-[14px] font-semibold leading-[1.4] tracking-[0.3px]',
                  labelStyles[state],
                )}
              >
                {label}
              </span>
            </div>

            {i < labels.length - 1 && (
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
