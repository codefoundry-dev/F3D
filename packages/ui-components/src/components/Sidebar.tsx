import { type ReactNode, useCallback, useState } from 'react';

import ArrowRightIcon from '../assets/icons/arrow-right.svg?react';
import OpenSidebarIcon from '../assets/icons/open-sidebar.svg?react';
import { cn } from '../utils/cn';

import { useMobileNavHidden } from './MobileChrome';
import { Modal } from './Modal';
import { Tooltip } from './Tooltip';

// v2: the v1 key was written on every mount, so a stored "false" never meant the
// user chose to expand. v2 is only written when the user toggles the rail.
const STORAGE_KEY = 'sidebar-collapsed-v2';
/** Below this viewport width (13–14" laptops) the rail starts collapsed. */
const AUTO_COLLAPSE_BELOW_PX = 1280;

export interface SidebarNavItem {
  icon: ReactNode;
  label: string;
  /** Compact label for the phone bottom bar (falls back to `label`). */
  shortLabel?: string;
  href: string;
  isActive: boolean;
  hasSubmenu?: boolean;
}

export interface SidebarProps {
  items: SidebarNavItem[];
  onNavigate: (href: string) => void;
  logo?: ReactNode;
  onLogoClick?: () => void;
  /** Brand / company wordmark shown next to the logo when expanded. */
  companyName?: string;
  /**
   * Phone bottom bar (ADR-0019 / FOR-369): the hrefs to show, in order, when the
   * role has more than {@link MOBILE_BAR_SLOTS} items. The rest go in "More".
   * Ignored when every item fits.
   */
  mobilePrimaryHrefs?: readonly string[];
  /** Label for the "More" tab + sheet title. */
  moreLabel?: string;
  /** Extra rows at the bottom of the More sheet (e.g. Profile, Log out). */
  moreExtras?: ReactNode;
  /** Controlled open state of the More sheet (so the top-bar avatar can open it). */
  moreOpen?: boolean;
  onMoreOpenChange?: (open: boolean) => void;
}

/** Bottom-bar section slots on phones; a 5th slot is "More" when needed. */
export const MOBILE_BAR_SLOTS = 4;

/** Split nav items into the phone bottom bar and the More sheet. */
export function splitMobileNav(
  items: SidebarNavItem[],
  primaryHrefs: readonly string[] = [],
): { bar: SidebarNavItem[]; more: SidebarNavItem[] } {
  if (items.length <= MOBILE_BAR_SLOTS) return { bar: items, more: [] };
  const byHref = new Map(items.map((i) => [i.href, i]));
  const picked = primaryHrefs
    .map((h) => byHref.get(h))
    .filter((i): i is SidebarNavItem => !!i)
    .slice(0, MOBILE_BAR_SLOTS);
  const bar = picked.length ? picked : items.slice(0, MOBILE_BAR_SLOTS);
  const barHrefs = new Set(bar.map((i) => i.href));
  return { bar, more: items.filter((i) => !barHrefs.has(i.href)) };
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  );
}

function readCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === 'true';
  } catch {
    /* storage blocked — fall through to the width default */
  }
  return typeof window !== 'undefined' && window.innerWidth < AUTO_COLLAPSE_BELOW_PX;
}

/** A single 34px square icon-button used for the logo + collapse toggle. */
function RailIconButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'flex size-[34px] shrink-0 items-center justify-center rounded-[12px] text-gray-500 transition-colors hover:bg-[#F4F4F6] hover:text-foreground cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Sidebar({
  items,
  onNavigate,
  logo,
  onLogoClick,
  companyName,
  mobilePrimaryHrefs,
  moreLabel = 'More',
  moreExtras,
  moreOpen,
  onMoreOpenChange,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);
  const [moreOpenLocal, setMoreOpenLocal] = useState(false);
  const isMoreOpen = moreOpen ?? moreOpenLocal;
  const setMoreOpen = (open: boolean) => {
    setMoreOpenLocal(open);
    onMoreOpenChange?.(open);
  };
  const { bar, more } = splitMobileNav(items, mobilePrimaryHrefs);
  // Wizards hide the phone bottom nav while open (ADR-0019 B8).
  const navHidden = useMobileNavHidden();
  const moreActive = more.some((i) => i.isActive);

  const toggle = useCallback(
    () =>
      setIsCollapsed((c) => {
        try {
          localStorage.setItem(STORAGE_KEY, String(!c));
        } catch {
          /* noop */
        }
        return !c;
      }),
    [],
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-white border-r border-[#E8EAED] h-full transition-[width] duration-200 ease-in-out p-2',
          isCollapsed ? 'w-[56px]' : 'w-[224px]',
        )}
      >
        {/* Header: logo lockup + (expanded) collapse toggle */}
        <div
          className={cn(
            'flex shrink-0 items-center',
            isCollapsed ? 'justify-center' : 'gap-2.5 pl-0.5',
          )}
        >
          {logo && (
            <button
              type="button"
              aria-label="Home"
              onClick={onLogoClick}
              className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] transition-opacity hover:opacity-90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {logo}
            </button>
          )}

          {!isCollapsed && companyName && (
            <span className="flex-1 truncate py-[7px] text-[14px] font-semibold tracking-[0.3px] text-[#2D3139]">
              {companyName}
            </span>
          )}

          {!isCollapsed && (
            <RailIconButton aria-label="Collapse sidebar" onClick={toggle} className="ml-auto">
              <OpenSidebarIcon className="h-[18px] w-[18px]" />
            </RailIconButton>
          )}
        </div>

        {/* Divider */}
        <div className="my-2 h-px w-full shrink-0 bg-[#E8EAED]" />

        {/* Nav items */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {items.map((item) => {
            const button = (
              <button
                type="button"
                onClick={() => onNavigate(item.href)}
                className={cn(
                  'flex h-10 items-center rounded-[12px] transition-colors cursor-pointer',
                  isCollapsed ? 'w-10 justify-center mx-auto' : 'w-full gap-3 px-2',
                  item.isActive
                    ? 'bg-[#F4F4F6] text-[#1B1D22]'
                    : 'text-[#40454F] hover:bg-[#F9F9FA] hover:text-[#1B1D22]',
                )}
              >
                <span className="flex size-[18px] shrink-0 items-center justify-center [&_svg]:size-[18px]">
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <>
                    <span className="flex-1 truncate text-left text-[14px] font-semibold tracking-[0.3px]">
                      {item.label}
                    </span>
                    {item.hasSubmenu && (
                      <ArrowRightIcon className="h-[18px] w-[18px] shrink-0 text-gray-400" />
                    )}
                  </>
                )}
              </button>
            );

            return (
              <div key={item.href}>
                {isCollapsed ? (
                  <Tooltip content={item.label} side="right" delay={800}>
                    {button}
                  </Tooltip>
                ) : (
                  button
                )}
              </div>
            );
          })}
        </nav>

        {/* Collapsed: expand toggle pinned to the bottom of the rail (Figma 3947-75707) */}
        {isCollapsed && (
          <div className="flex shrink-0 justify-center pt-1">
            <RailIconButton aria-label="Expand sidebar" onClick={toggle}>
              <OpenSidebarIcon className="h-[18px] w-[18px]" />
            </RailIconButton>
          </div>
        )}
      </aside>

      {/* Phone: bottom tab bar — up to 4 labelled sections + "More" (ADR-0019). */}
      <nav
        aria-label="Primary"
        className={cn(
          'md:hidden fixed bottom-0 left-0 right-0 z-40 items-stretch border-t border-[#E8EAED] bg-white pb-[env(safe-area-inset-bottom)]',
          navHidden ? 'hidden' : 'flex',
        )}
      >
        {bar.map((item) => (
          <MobileTab
            key={item.href}
            icon={item.icon}
            label={item.shortLabel ?? item.label}
            active={item.isActive}
            onClick={() => onNavigate(item.href)}
          />
        ))}
        {more.length > 0 && (
          <MobileTab
            icon={<MoreIcon />}
            label={moreLabel}
            active={moreActive || isMoreOpen}
            onClick={() => setMoreOpen(true)}
          />
        )}
      </nav>

      {isMoreOpen && (
        <Modal onClose={() => setMoreOpen(false)} mobile="sheet">
          <div className="px-4 pb-4">
            <h2 className="px-2 pb-2 text-base font-semibold text-foreground">{moreLabel}</h2>
            <ul className="flex flex-col">
              {more.map((item) => (
                <li key={item.href}>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      onNavigate(item.href);
                    }}
                    className={cn(
                      'flex h-12 w-full items-center gap-3 rounded-[10px] px-2 text-left text-[15px] font-semibold [&_svg]:size-[20px]',
                      item.isActive ? 'bg-[#F4F4F6] text-[#1B1D22]' : 'text-gray-700',
                    )}
                  >
                    <span className="flex size-6 items-center justify-center">{item.icon}</span>
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
            {moreExtras && (
              <div className={cn(more.length > 0 && 'mt-2 border-t border-[#E8EAED] pt-2')}>
                {moreExtras}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

/** One phone bottom-bar slot: icon over a label, ≥48px tall touch target. */
function MobileTab({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 transition-colors [&_svg]:size-[22px]',
        active ? 'text-[#1B1D22]' : 'text-gray-500',
      )}
    >
      <span
        className={cn(
          'flex h-7 w-12 items-center justify-center rounded-full',
          active && 'bg-[#F4F4F6]',
        )}
      >
        {icon}
      </span>
      <span className="w-full truncate text-center text-[11px] font-semibold leading-none">
        {label}
      </span>
    </button>
  );
}
