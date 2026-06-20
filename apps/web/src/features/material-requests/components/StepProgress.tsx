import { useTranslation } from '@forethread/i18n';

/**
 * "Step N of 3 / <label>" header plus the progress bar (Figma 2002:176 — the
 * 6px track is #E8EAED with a #1B1D22 fill). Sits directly under the dark
 * header on every wizard step.
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
    <div className="flex flex-col gap-[5px] bg-white px-4 py-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#525866]">
          {t('requestMaterials.stepOf', { current, total })}
        </span>
        <span className="text-xs text-[#525866]">{label}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E8EAED]">
        <div
          className="h-full rounded-full bg-[#1B1D22] transition-all"
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
