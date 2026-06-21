import { useTranslation } from '@forethread/i18n';
import CheckmarkIcon from '@forethread/ui-components/assets/icons/checkmark.svg?react';

/**
 * Horizontal procurement-status timeline on Job Overview (Figma 2002:176 frame
 * 14:4 — "StatusBar"). Completed stages render filled (#D2D5DB chip, check
 * icon); the remaining stages render on a white chip with a hollow marker. The
 * row scrolls horizontally on narrow screens, matching the design annotation
 * "Horizontal scroll".
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
    <div className="flex flex-col gap-2">
      <p className="text-base text-gray-900">{t('jobOverview.procurementStatus')}</p>
      <div className="-mx-4 overflow-x-auto px-4 pb-1">
        <div className="flex w-max gap-1.5">
          {stages.map((stage) => (
            <span
              key={stage.key}
              className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-xs ${
                stage.done
                  ? 'bg-gray-200 text-gray-900'
                  : 'bg-white text-gray-500 ring-1 ring-inset ring-gray-200'
              }`}
            >
              {stage.done ? (
                <CheckmarkIcon className="h-3 w-3" />
              ) : (
                <span className="h-2.5 w-2.5 rounded-full border border-gray-400" />
              )}
              {stage.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
