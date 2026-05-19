import ArrowDownIcon from '@forethread/ui-components/assets/icons/arrow-down.svg?react';
import TrendUpIcon from '@forethread/ui-components/assets/icons/trend-up.svg?react';

interface KpiCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  valueClassName?: string;
  trend?: string;
  trendUp?: boolean;
  statusIcon?: React.ReactNode;
}

export function KpiCard({
  icon,
  title,
  value,
  valueClassName,
  trend,
  trendUp,
  statusIcon,
}: KpiCardProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-4 flex items-start gap-4">
      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{title}</p>
        <div className="flex items-baseline gap-2 mt-1">
          {statusIcon && <span className="flex items-center">{statusIcon}</span>}
          <span className={valueClassName}>{value}</span>
          {trend && (
            <span
              className={`flex items-center gap-1 text-xs ${trendUp ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'}`}
            >
              {trendUp ? (
                <TrendUpIcon className="w-4 h-4" />
              ) : (
                <ArrowDownIcon className="w-4 h-4" />
              )}
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
