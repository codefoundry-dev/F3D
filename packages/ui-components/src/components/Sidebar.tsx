import { type ReactNode, useCallback, useEffect, useState } from 'react';

import ArrowRightIcon from '../assets/icons/arrow-right.svg?react';
import OpenSidebarIcon from '../assets/icons/open-sidebar.svg?react';
import { cn } from '../utils/cn';
import { Tooltip } from './Tooltip';

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
  /** Brand / company wordmark shown next to the logo when expanded. */
  companyName?: string;
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
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

export function Sidebar({ items, onNavigate, logo, onLogoClick, companyName }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isCollapsed));
    } catch {
      /* noop */
    }
  }, [isCollapsed]);

  const toggle = useCallback(() => setIsCollapsed((c) => !c), []);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-white border-r border-[#E8EAED] h-full transition-[width] duration-200 ease-in-out p-2',
          isCollapsed ? 'w-[68px]' : 'w-[224px]',
        )}
      >
        {/* Header: logo lockup + collapse toggle */}
        <div
          className={cn(
            'flex items-center shrink-0',
            isCollapsed ? 'flex-col gap-2' : 'gap-2.5 pl-0.5',
          )}
        >
          {logo && (
            <button
              type="button"
              aria-label="Home"
              onClick={onLogoClick}
              className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] transition-opacity hover:opacity-90 cursor-pointer"
            >
              {logo}
            </button>
          )}

          {!isCollapsed && companyName && (
            <span className="flex-1 truncate py-[7px] text-[14px] font-semibold tracking-[0.3px] text-[#2D3139]">
              {companyName}
            </span>
          )}

          <RailIconButton
            aria-label="Toggle sidebar"
            onClick={toggle}
            className={isCollapsed ? '' : 'ml-auto'}
          >
            <OpenSidebarIcon className="h-[18px] w-[18px]" />
          </RailIconButton>
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
      </aside>

      {/* Mobile: bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E8EAED] flex items-center justify-around h-14">
        {items.map((item) => (
          <button
            key={item.href}
            type="button"
            aria-label={item.label}
            onClick={() => onNavigate(item.href)}
            className={cn(
              'flex items-center justify-center w-10 h-10 rounded-[10px] transition-colors [&_svg]:size-[20px]',
              item.isActive
                ? 'bg-[#F4F4F6] text-[#1B1D22]'
                : 'text-gray-500 hover:text-foreground hover:bg-[#F4F4F6]',
            )}
          >
            {item.icon}
          </button>
        ))}
      </nav>
    </>
  );
}
