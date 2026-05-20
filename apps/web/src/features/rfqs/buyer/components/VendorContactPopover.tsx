import type { RfqVendorContact } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { cn } from '@forethread/ui-components';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import PhoneIcon from '@forethread/ui-components/assets/icons/phone.svg?react';
import { useEffect, useRef, useState } from 'react';

interface VendorContactPopoverProps {
  contacts: RfqVendorContact[];
  children: React.ReactNode;
}

export function VendorContactPopover({ contacts, children }: VendorContactPopoverProps) {
  const { t } = useTranslation('rfqs');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button type="button" onClick={() => setOpen((p) => !p)} className="inline-flex">
        {children}
      </button>
      {open && contacts.length > 0 && (
        <div
          className={cn(
            'absolute z-50 right-0 top-full mt-1',
            'w-72 bg-card rounded-[10px] border border-foreground/20',
            'shadow-lg p-4',
          )}
        >
          <h4 className="text-sm font-medium text-foreground mb-3">
            {t('detailFields.salesContacts')}
          </h4>
          <div className="space-y-3">
            {contacts.map((contact) => (
              <div key={contact.id} className="space-y-1">
                <p className="text-sm font-medium text-foreground">{contact.name}</p>
                <p className="text-xs text-muted-foreground">{contact.role}</p>
                {contact.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <PhoneIcon className="w-3 h-3" />
                    <span>{contact.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <EnvelopeIcon className="w-3 h-3" />
                  <span>{contact.email}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
