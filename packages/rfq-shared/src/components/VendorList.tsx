import type { RfqVendor } from '@forethread/api-client';
import { Badge, cn } from '@forethread/ui-components';
import UsersGroupIcon from '@forethread/ui-components/assets/icons/users-group.svg?react';
import { Fragment, useState } from 'react';

import { CompactContactBlock, VendorContactPopover } from './VendorContactPopover';

interface VendorListProps {
  vendors: RfqVendor[];
  compact?: boolean;
}

function VendorAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="w-8 h-8 rounded-full object-cover" />;
  }
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
      {initials}
    </div>
  );
}

export function VendorList({ vendors, compact = false }: VendorListProps) {
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);

  if (vendors.length === 0) return null;

  return (
    <div className={cn('w-full overflow-x-auto', compact ? 'text-xs' : 'text-sm')}>
      <table className="w-full min-w-[400px]">
        <tbody>
          {vendors.map((vendor) => (
            <Fragment key={vendor.id}>
              <tr
                className={cn(
                  vendor.approved && 'bg-success/20',
                  compact && expandedVendorId === vendor.id ? '' : 'border-b border-foreground/10',
                )}
              >
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <VendorAvatar name={vendor.name} avatarUrl={vendor.avatarUrl} />
                    <span
                      className={cn(
                        'text-foreground font-medium',
                        compact ? 'truncate max-w-[120px]' : 'whitespace-nowrap',
                      )}
                    >
                      {vendor.name}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    {vendor.approved && (
                      <Badge className="bg-success text-white text-[10px]">Approved</Badge>
                    )}
                    {vendor.contacts.length > 0 &&
                      (compact ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedVendorId((prev) => (prev === vendor.id ? null : vendor.id))
                          }
                          className="flex items-center justify-center w-6 h-6 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                        >
                          <UsersGroupIcon className="w-4 h-4" />
                        </button>
                      ) : (
                        <VendorContactPopover contacts={vendor.contacts} />
                      ))}
                  </div>
                </td>
                <td
                  className={cn(
                    'py-2.5 px-3 text-muted-foreground',
                    compact ? 'truncate max-w-[80px]' : 'whitespace-nowrap',
                  )}
                >
                  {vendor.category ?? '-'}
                </td>
                <td
                  className={cn(
                    'py-2.5 pl-3 text-muted-foreground',
                    compact ? 'truncate max-w-[80px]' : 'whitespace-nowrap',
                  )}
                >
                  {vendor.location ?? '-'}
                </td>
              </tr>
              {/* Compact: inline contact block below vendor row */}
              {compact && expandedVendorId === vendor.id && vendor.contacts.length > 0 && (
                <tr>
                  <td colSpan={4} className="p-0 pb-1">
                    <CompactContactBlock contacts={vendor.contacts} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
