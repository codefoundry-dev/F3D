import type { RfqVendorContact } from '@forethread/api-client';
import { cn, DotActionsMenu } from '@forethread/ui-components';
import UsersGroupIcon from '@forethread/ui-components/assets/icons/users-group.svg?react';
import { useEffect, useRef, useState } from 'react';

interface VendorContactPopoverProps {
  contacts: RfqVendorContact[];
}

/** Desktop popover contacts table — auto column widths, no truncation */
function DesktopContactTable({ contacts }: { contacts: RfqVendorContact[] }) {
  return (
    <table className="w-full">
      <tbody>
        {contacts.map((contact) => (
          <tr key={contact.id}>
            <td className="py-1 pr-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground flex-shrink-0">
                  {contact.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground leading-tight whitespace-nowrap">
                    {contact.name}
                  </span>
                  <span className="text-xs text-muted-foreground leading-tight whitespace-nowrap">
                    {contact.role}
                  </span>
                </div>
              </div>
            </td>
            <td className="py-1 px-3 text-sm text-muted-foreground whitespace-nowrap">
              {contact.phone ?? '-'}
            </td>
            <td className="py-1 pl-3 text-sm text-muted-foreground break-all">{contact.email}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Compact row for panel — with truncation */
function CompactContactRows({ contacts }: { contacts: RfqVendorContact[] }) {
  return (
    <table className="w-full table-fixed">
      <colgroup>
        <col className="w-[40%]" />
        <col className="w-[30%]" />
        <col className="w-[30%]" />
      </colgroup>
      <tbody>
        {contacts.map((contact) => (
          <tr key={contact.id} className="border-b border-foreground/5 last:border-b-0">
            <td className="py-1.5 px-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground flex-shrink-0">
                  {contact.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-foreground leading-tight truncate">
                    {contact.name}
                  </span>
                  <span className="text-xs text-muted-foreground leading-tight truncate">
                    {contact.role}
                  </span>
                </div>
              </div>
            </td>
            <td className="py-1.5 px-2 text-sm text-muted-foreground truncate">
              {contact.phone ?? '-'}
            </td>
            <td className="py-1.5 px-2 text-sm text-muted-foreground truncate">{contact.email}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function VendorContactPopover({ contacts }: VendorContactPopoverProps) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!open || isMobile) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, isMobile]);

  useEffect(() => {
    if (!open || isMobile) return;
    const handler = () => setOpen(false);
    window.addEventListener('scroll', handler, true);
    return () => window.removeEventListener('scroll', handler, true);
  }, [open, isMobile]);

  const show = () => {
    if (isMobile || !triggerRef.current) return;
    clearTimeout(timeoutRef.current);
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.left });
    setOpen(true);
  };

  const hide = () => {
    if (isMobile) return;
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  const keepOpen = () => {
    clearTimeout(timeoutRef.current);
  };

  if (contacts.length === 0) return null;

  if (isMobile) {
    return (
      <DotActionsMenu
        actions={contacts.map((c) => ({
          key: c.id,
          label: `${c.name} — ${c.role}${c.phone ? ` · ${c.phone}` : ''} · ${c.email}`,
          onClick: () => {
            /* no-op, just info display */
          },
        }))}
        trigger={<UsersGroupIcon className="w-4 h-4" />}
        triggerClassName="!border-0 !p-0 !rounded"
        bordered={false}
      />
    );
  }

  return (
    <>
      <span
        ref={triggerRef}
        className="flex items-center justify-center w-6 h-6 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        <UsersGroupIcon className="w-4 h-4" />
      </span>
      {open && menuPos && (
        <div
          ref={menuRef}
          className={cn(
            'fixed z-50 min-w-[434px] max-w-[560px]',
            'bg-card rounded-[10px] border border-foreground/20 shadow-lg',
            'px-3 py-1',
          )}
          style={{ top: menuPos.top, left: menuPos.left }}
          onMouseEnter={keepOpen}
          onMouseLeave={hide}
        >
          <DesktopContactTable contacts={contacts} />
        </div>
      )}
    </>
  );
}

/** Compact inline contact block — rendered below vendor row in panel mode */
export function CompactContactBlock({ contacts }: { contacts: RfqVendorContact[] }) {
  return (
    <div className="border border-foreground/10 rounded-lg overflow-hidden">
      <CompactContactRows contacts={contacts} />
    </div>
  );
}
