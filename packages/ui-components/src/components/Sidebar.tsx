import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import ArrowRightIcon from '../assets/icons/arrow-right.svg?react';
import OpenSidebarIcon from '../assets/icons/open-sidebar.svg?react';
import { cn } from '../utils/cn';

const STORAGE_KEY = 'sidebar-collapsed';

export interface SidebarNavItem {
  icon: ReactNode;
  label: string;
  href: string;
  isActive: boolean;
  hasSubmenu?: boolean;
}

export interface SidebarProps {
  items: SidebarNavItem[];
  onNavigate: (href: string) => void;
  logo?: ReactNode;
  onLogoClick?: () => void;
  companyName?: string;
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/* ── Fixed-position tooltip that escapes overflow containers ── */
function SidebarTooltip({
  label,
  anchorRef,
}: {
  label: string;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Find the sidebar <aside> to position tooltip after its right border
    const aside = el.closest('aside');
    const sidebarRight = aside ? aside.getBoundingClientRect().right : rect.right;
    setPos({
      top: rect.top + rect.height / 2,
      left: sidebarRight + 8,
    });
  }, [anchorRef]);

  if (!pos) return null;

  return createPortal(
    <div
      role="tooltip"
      className="fixed z-[9999] -translate-y-1/2 pointer-events-none"
      style={{ top: pos.top, left: pos.left }}
    >
      {/* Arrow */}
      <span
        className="absolute top-1/2 -translate-y-1/2 -left-[6px] w-0 h-0"
        style={{
          borderTop: '6px solid transparent',
          borderBottom: '6px solid transparent',
          borderRight: '6px solid #2D3139',
        }}
      />
      {/* Label */}
      <span className="block bg-[#2D3139] text-white text-sm font-bold px-3 py-2 rounded-lg max-w-[160px] whitespace-nowrap">
        {label}
      </span>
    </div>,
    document.body,
  );
}

export function Sidebar({ items, onNavigate, logo, onLogoClick, companyName }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isCollapsed));
    } catch {
      /* noop */
    }
  }, [isCollapsed]);

  const toggle = useCallback(() => setIsCollapsed((c) => !c), []);

  const setItemRef = useCallback(
    (href: string) => (el: HTMLButtonElement | null) => {
      itemRefs.current.set(href, el);
    },
    [],
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-card border-r border-border h-full transition-[width] duration-200 ease-in-out overflow-hidden',
          isCollapsed ? 'w-16' : 'w-[240px]',
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-center shrink-0 h-16',
            isCollapsed ? 'justify-center px-3' : 'px-4 gap-3',
          )}
        >
          {logo && (
            <button
              type="button"
              aria-label="Home"
              onClick={onLogoClick}
              className="shrink-0 flex items-center justify-center w-10 h-10 rounded-md transition-colors hover:bg-accent cursor-pointer"
            >
              {logo}
            </button>
          )}

          {!isCollapsed && (
            <>
              {companyName && (
                <span className="text-sm font-semibold text-foreground truncate flex-1">
                  {companyName}
                </span>
              )}
              <button
                type="button"
                aria-label="Toggle sidebar"
                onClick={toggle}
                className="shrink-0 flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors ml-auto cursor-pointer"
              >
                <OpenSidebarIcon className="w-[18px] h-[18px]" />
              </button>
            </>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col gap-1 px-3 py-3 overflow-y-auto">
          {items.map((item) => (
            <div key={item.href}>
              <button
                ref={setItemRef(item.href)}
                type="button"
                onClick={() => onNavigate(item.href)}
                onMouseEnter={isCollapsed ? () => setHoveredHref(item.href) : undefined}
                onMouseLeave={isCollapsed ? () => setHoveredHref(null) : undefined}
                className={cn(
                  'flex items-center w-full rounded-md transition-colors cursor-pointer',
                  isCollapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 px-3 h-10',
                  item.isActive
                    ? 'bg-[#E8EAED] text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                )}
              >
                <span className="flex items-center justify-center w-5 h-5 shrink-0">
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <>
                    <span className="text-sm truncate flex-1 text-left">{item.label}</span>
                    {item.hasSubmenu && (
                      <ArrowRightIcon className="w-[18px] h-[18px] shrink-0 text-muted-foreground" />
                    )}
                  </>
                )}
              </button>

              {/* Tooltip via portal (collapsed mode only) */}
              {isCollapsed && hoveredHref === item.href && (
                <SidebarTooltip
                  label={item.label}
                  anchorRef={{ current: itemRefs.current.get(item.href) ?? null }}
                />
              )}
            </div>
          ))}
        </nav>

        {/* Collapsed toggle at bottom */}
        {isCollapsed && (
          <div className="shrink-0 flex justify-center px-3 py-3">
            <button
              type="button"
              aria-label="Expand sidebar"
              onClick={toggle}
              className="flex items-center justify-center w-10 h-10 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              <OpenSidebarIcon className="w-[18px] h-[18px]" />
            </button>
          </div>
        )}
      </aside>

      {/* Mobile: bottom tab bar (unchanged) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex items-center justify-around h-14">
        {items.map((item) => (
          <button
            key={item.href}
            type="button"
            aria-label={item.label}
            onClick={() => onNavigate(item.href)}
            className={cn(
              'flex items-center justify-center w-10 h-10 rounded-[4px] transition-colors',
              item.isActive
                ? 'bg-secondary-foreground text-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
          >
            {item.icon}
          </button>
        ))}
      </nav>
    </>
  );
}
