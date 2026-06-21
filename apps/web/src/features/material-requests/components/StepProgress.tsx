import { useTranslation } from '@forethread/i18n';

/**
 * "Step N of 3 / <label>" header plus the progress bar (Figma 2002:176). Uses DS
 * tokens — a gray-100 track with a gray-900 fill — and sits at the top of each
 * wizard step.
 */
export interface StepProgressProps {
  current: number;
  total: number;
  label: string;
}

export function StepProgress({ current, total, label }: StepProgressProps) {
  const { t } = useTranslation('materialRequests');
  const pct = Math.max(0, Math.min(100, Math.round((current / total) * 100)));

  return (
    <div className="flex flex-col gap-1.5 pb-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">
          {t('requestMaterials.stepOf', { current, total })}
        </span>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-gray-900 transition-all"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={total}
        />
      </div>
    </div>
  );
}
