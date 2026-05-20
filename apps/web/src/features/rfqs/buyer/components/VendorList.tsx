import type { RfqVendor } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Badge, cn } from '@forethread/ui-components';
import UsersGroupIcon from '@forethread/ui-components/assets/icons/users-group.svg?react';

import { VendorContactPopover } from './VendorContactPopover';

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
  const { t } = useTranslation('rfqs');

  if (vendors.length === 0) return null;

  return (
    <div className={cn('w-full', compact ? 'text-xs' : 'text-sm')}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-foreground/10 text-left">
            <th className="pb-2 font-medium text-muted-foreground pr-3">
              {t('detailFields.name')}
            </th>
            <th className="pb-2 font-medium text-muted-foreground px-3" />
            <th className="pb-2 font-medium text-muted-foreground px-3">
              {t('detailFields.category')}
            </th>
            <th className="pb-2 font-medium text-muted-foreground pl-3">
              {t('detailFields.location')}
            </th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((vendor) => (
            <tr
              key={vendor.id}
              className={cn(
                'border-b border-foreground/10',
                vendor.approved && 'bg-[rgba(0,166,62,0.08)]',
              )}
            >
              <td className="py-2.5 pr-3">
                <div className="flex items-center gap-2">
                  <VendorAvatar name={vendor.name} avatarUrl={vendor.avatarUrl} />
                  <span className="text-foreground font-medium">{vendor.name}</span>
                </div>
              </td>
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-2">
                  {vendor.approved && (
                    <Badge className="bg-[#00a63e] text-white text-[10px]">
                      {t('detailFields.approved')}
                    </Badge>
                  )}
                  {vendor.contacts.length > 0 && (
                    <VendorContactPopover contacts={vendor.contacts}>
                      <span className="flex items-center justify-center w-6 h-6 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer">
                        <UsersGroupIcon className="w-4 h-4" />
                      </span>
                    </VendorContactPopover>
                  )}
                </div>
              </td>
              <td className="py-2.5 px-3 text-muted-foreground">{vendor.category ?? '-'}</td>
              <td className="py-2.5 pl-3 text-muted-foreground">{vendor.location ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
