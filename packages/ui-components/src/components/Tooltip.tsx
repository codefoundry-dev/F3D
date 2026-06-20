import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../utils/cn';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** The trigger element. Must accept a ref + mouse/focus handlers. */
  children: ReactElement;
  /** Tooltip body. Use `title` for the bold heading of the rich variant. */
  content: ReactNode;
  title?: string;
  side?: TooltipSide;
  /** Hover open delay in ms (Figma sidebar uses 800ms). */
  delay?: number;
  className?: string;
  disabled?: boolean;
}

const GAP = 8; // distance between trigger and tooltip (px)

/**
 * Tooltip — Forethread design system (Figma node 3650-4858).
 *
 * Dark floating tooltip rendered through a portal so it escapes `overflow:hidden`
 * / `overflow:auto` ancestors. Supports the 4 sides + a caret, a plain or a
 * title+body (rich) variant, and a configurable hover delay.
 */
export function Tooltip({
  children,
  content,
  title,
  side = 'top',
  delay = 300,
  className,
  disabled,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const map: Record<TooltipSide, { top: number; left: number }> = {
      top: { top: r.top - GAP, left: r.left + r.width / 2 },
      bottom: { top: r.bottom + GAP, left: r.left + r.width / 2 },
      left: { top: r.top + r.height / 2, left: r.left - GAP },
      right: { top: r.top + r.height / 2, left: r.right + GAP },
    };
    setPos(map[side]);
  }, [side]);

  const show = useCallback(() => {
    if (disabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      place();
      setOpen(true);
    }, delay);
  }, [delay, disabled, place]);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!isValidElement(children)) return children;

  // Transforms that center the tooltip on the chosen side.
  const transform: Record<TooltipSide, string> = {
    top: 'translate(-50%, -100%)',
    bottom: 'translate(-50%, 0)',
    left: 'translate(-100%, -50%)',
    right: 'translate(0, -50%)',
  };

  const arrowClass: Record<TooltipSide, string> = {
    top: 'left-1/2 -translate-x-1/2 -bottom-[5px] border-t-[#2D3139] border-x-transparent border-b-0',
    bottom:
      'left-1/2 -translate-x-1/2 -top-[5px] border-b-[#2D3139] border-x-transparent border-t-0',
    left: 'top-1/2 -translate-y-1/2 -right-[5px] border-l-[#2D3139] border-y-transparent border-r-0',
    right:
      'top-1/2 -translate-y-1/2 -left-[5px] border-r-[#2D3139] border-y-transparent border-l-0',
  };

  const trigger = cloneElement(children as ReactElement<Record<string, unknown>>, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const r = (children as { ref?: unknown }).ref;
      if (typeof r === 'function') r(node);
      else if (r && typeof r === 'object') (r as { current: unknown }).current = node;
    },
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
    'aria-describedby': open ? tooltipId : undefined,
  });

  return (
    <>
      {trigger}
      {open &&
        pos &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none fixed z-[9999]"
            style={{ top: pos.top, left: pos.left, transform: transform[side] }}
          >
            <div
              className={cn(
                'relative max-w-[260px] rounded-lg bg-[#2D3139] px-3 py-2 text-white shadow-lg',
                className,
              )}
            >
              {title && <p className="text-sm font-bold leading-tight">{title}</p>}
              {content && (
                <p
                  className={cn(
                    'text-xs leading-snug',
                    title ? 'mt-1 text-white/80' : 'font-semibold',
                  )}
                >
                  {content}
                </p>
              )}
              <span
                className={cn('absolute h-0 w-0 border-[6px] border-solid', arrowClass[side])}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
