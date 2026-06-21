import { type ReactNode } from 'react';

import BackArrowIcon from '../assets/icons/back-arrow.svg?react';
import { cn } from '../utils/cn';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backIcon?: ReactNode;
  /**
   * Optional leading icon, rendered inside a 28px gradient-white chip before the
   * title (the in-content page-header affordance from the design system).
   */
  icon?: ReactNode;
  /** Right-aligned slot (action buttons). When present the row is space-between. */
  actions?: ReactNode;
  className?: string;
}

/** Gradient-white icon chip used for the in-content page header. */
const ICON_CHIP =
  'flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white p-px text-gray-700 shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]';

export function PageHeader({
  title,
  subtitle,
  onBack,
  backIcon,
  icon,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn('flex items-center gap-3 min-w-0', actions && 'w-full justify-between', className)}
    >
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="flex items-center justify-center w-8 h-8 rounded-[10px] text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors shrink-0"
          >
            {backIcon ?? <BackArrowIcon className="w-5 h-5" />}
          </button>
        )}
        {icon && <span className={ICON_CHIP}>{icon}</span>}
        <div className="min-w-0">
          <h1
            className={cn(
              'font-semibold text-gray-900 leading-tight truncate',
              icon ? 'text-[20px] tracking-[0.3px]' : 'text-lg',
            )}
          >
            {title}
          </h1>
          {subtitle && <p className="text-sm text-gray-500 leading-tight truncate">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
