import ArrowDownIcon from '@forethread/ui-components/assets/icons/arrow-down.svg?react';
import TrendUpIcon from '@forethread/ui-components/assets/icons/trend-up.svg?react';

type TrendDirection = 'up' | 'down' | 'flat';

interface KpiCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  valueClassName?: string;
  /** Pre-formatted trend label, e.g. "-2 this week" / "+3 this week" / "0 this week". */
  trend?: string;
  /** Drives the leading direction arrow. Defaults to "up". */
  trendDirection?: TrendDirection;
  statusIcon?: React.ReactNode;
}

export function KpiCard({
  icon,
  title,
  value,
  valueClassName,
  trend,
  trendDirection = 'up',
  statusIcon,
}: KpiCardProps) {
  return (
    <div className="bg-card rounded-[14px] border-[0.8px] border-[rgba(0,0,0,0.2)] px-[16.8px] py-[12.8px] flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-[hsl(var(--foreground))]/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex flex-col gap-1">
        <p className="text-sm font-medium text-muted-foreground whitespace-nowrap">{title}</p>
        <div className="flex items-center gap-3">
          {statusIcon && <span className="flex items-center">{statusIcon}</span>}
          <span className={valueClassName}>{value}</span>
          {trend && (
            <span className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
              {trendDirection === 'down' ? (
                <ArrowDownIcon className="w-4 h-4 shrink-0" />
              ) : (
                <TrendUpIcon className="w-4 h-4 shrink-0" />
              )}
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
