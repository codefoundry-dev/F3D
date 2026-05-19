import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import ThreeDotIcon from '../assets/icons/three-dot.svg?react';
import { cn } from '../utils/cn';

export interface DotAction {
  key: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export interface DotActionsMenuProps {
  actions: DotAction[];
  className?: string;
  bordered?: boolean;
  /** Custom trigger content — replaces the default three-dot icon */
  trigger?: ReactNode;
  /** Additional classes for the trigger button */
  triggerClassName?: string;
  /** Additional classes for the dropdown menu panel */
  menuClassName?: string;
}

export function DotActionsMenu({
  actions,
  className,
  bordered = true,
  trigger,
  triggerClassName,
  menuClassName,
}: DotActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Calculate fixed position for the dropdown to escape overflow containers
  useLayoutEffect(() => {
    if (!isOpen || isMobile || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 192; // w-48 = 12rem = 192px
    const menuHeight = actions.length * 40 + 8; // ~40px per item + py-1

    const spaceBelow = window.innerHeight - rect.bottom;
    const dropUp = spaceBelow < menuHeight + 8;

    setMenuPos({
      top: dropUp ? rect.top - menuHeight - 4 : rect.bottom + 4,
      left: Math.max(8, rect.right - menuWidth),
    });
  }, [isOpen, isMobile, actions.length]);

  const close = useCallback(() => setIsOpen(false), []);

  // Close on click outside (desktop)
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, isMobile, close]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  // Close on scroll (the menu is fixed, so it would float away)
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const handler = () => close();
    window.addEventListener('scroll', handler, true);
    return () => window.removeEventListener('scroll', handler, true);
  }, [isOpen, isMobile, close]);

  const handleTrigger = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const handleAction = (action: DotAction) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!action.disabled) {
      action.onClick();
      close();
      triggerRef.current?.focus();
    }
  };

  const menuItems = (
    <>
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          onClick={handleAction(action)}
          disabled={action.disabled}
          className={cn(
            'w-full text-left px-4 py-2.5 text-sm text-card-foreground hover:bg-accent transition-colors',
            'flex items-center gap-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {action.icon && <span className="flex-shrink-0 w-4 h-4">{action.icon}</span>}
          {action.label}
        </button>
      ))}
    </>
  );

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTrigger}
        className={cn(
          'flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors',
          trigger
            ? 'px-4 py-2 border border-foreground/20 rounded-xl text-sm'
            : bordered
              ? 'w-[50px] h-[38px] border border-foreground/20'
              : 'p-1.5',
          triggerClassName,
        )}
        aria-label="Actions"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {trigger ?? <ThreeDotIcon className="w-4 h-4" />}
      </button>

      {isOpen && !isMobile && menuPos && (
        <div
          ref={menuRef}
          className={cn(
            'fixed w-48 bg-card border border-border rounded-lg shadow-lg z-50 py-1 overflow-hidden',
            menuClassName,
          )}
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          {menuItems}
        </div>
      )}

      {isOpen && isMobile && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
            }}
            role="presentation"
          />
          {/* Bottom sheet */}
          <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl z-50 pb-safe">
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-2" />
            <div className="py-2">{menuItems}</div>
            <div className="px-4 pb-4 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  close();
                }}
                className="w-full py-2.5 text-sm font-medium text-muted-foreground bg-muted rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
