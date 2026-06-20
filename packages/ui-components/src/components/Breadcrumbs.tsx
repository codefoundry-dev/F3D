import type { ReactNode } from 'react';

import ChevronRightIcon from '../assets/icons/chevron-right.svg?react';
import { cn } from '../utils/cn';

/**
 * Breadcrumbs — Forethread design system (Figma node 4162-76636 / header 4149-77993).
 *
 * Trail of items separated by a chevron (18px). Items use text/tertiary (#40454f),
 * Urbanist SemiBold 14px, tracking 0.3px, with a subtle grey hover shade on links.
 * An item carrying an `icon` renders it inside a 34px gradient-white chip (the
 * "Home" affordance). The last item is treated as the current page: text/primary
 * (#1B1D22), non-interactive, no trailing separator.
 */
export interface BreadcrumbItem {
  label: ReactNode;
  href?: string;
  onClick?: () => void;
  /** When set, the label is preceded by a 34px gradient-white icon chip. */
  icon?: ReactNode;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  'aria-label'?: string;
}

const ICON_CHIP =
  'flex size-[34px] shrink-0 items-center justify-center rounded-[10px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white p-px shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]';

export function Breadcrumbs({
  items,
  className,
  'aria-label': ariaLabel = 'Breadcrumb',
}: BreadcrumbsProps) {
  return (
    <nav aria-label={ariaLabel} className={cn('flex items-center', className)}>
      <ol className="flex items-center">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const interactive = !isLast && (item.href || item.onClick);

          const inner = (
            <span
              className={cn(
                'flex items-center gap-1 rounded-[8px] px-1.5 py-0.5 font-semibold leading-[1.4] tracking-[0.3px]',
                isLast ? 'text-gray-900' : 'text-gray-700',
                interactive && 'transition-colors hover:bg-gray-700/[0.08] hover:text-gray-900',
              )}
            >
              {item.icon ? <span className={ICON_CHIP}>{item.icon}</span> : null}
              <span className="text-[14px]">{item.label}</span>
            </span>
          );

          return (
            <li key={index} className="flex items-center">
              {item.href && !isLast ? (
                <a
                  href={item.href}
                  onClick={item.onClick}
                  aria-current={isLast ? 'page' : undefined}
                  className="rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {inner}
                </a>
              ) : item.onClick && !isLast ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {inner}
                </button>
              ) : (
                <span aria-current={isLast ? 'page' : undefined}>{inner}</span>
              )}
              {!isLast && (
                <ChevronRightIcon
                  className="mx-0.5 size-[18px] shrink-0 text-gray-400"
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
