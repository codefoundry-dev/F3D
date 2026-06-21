import { useTranslation } from '@forethread/i18n';
import CheckmarkIcon from '@forethread/ui-components/assets/icons/checkmark.svg?react';

/**
 * Horizontal procurement-status timeline on Job Overview (Figma 2002:176 frame
 * 14:4 — "StatusBar"). Completed stages render filled with a check; the
 * remaining stages render on a hairline chip with a hollow marker. The row
 * scrolls horizontally on narrow screens.
 */
export interface ProcurementStage {
  key: string;
  label: string;
  done: boolean;
}

export interface ProcurementStatusBarProps {
  stages: ProcurementStage[];
}

export function ProcurementStatusBar({ stages }: ProcurementStatusBarProps) {
  const { t } = useTranslation('materialRequests');
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base font-semibold text-foreground">
        {t('jobOverview.procurementStatus')}
      </p>
      <div className="overflow-x-auto pb-1">
        <div className="flex w-max items-center gap-1.5">
          {stages.map((stage) => (
            <span
              key={stage.key}
              className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-xs ${
                stage.done
                  ? 'bg-muted font-medium text-foreground'
                  : 'bg-background text-muted-foreground ring-1 ring-inset ring-border'
              }`}
            >
              {stage.done ? (
                <CheckmarkIcon className="size-3 text-muted-foreground" />
              ) : (
                <span className="size-2.5 rounded-full border border-muted-foreground/50" />
              )}
              {stage.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
