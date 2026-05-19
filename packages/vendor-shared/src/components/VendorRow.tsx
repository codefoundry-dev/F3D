import type { VendorListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { cn, Badge, DotActionsMenu, type DotAction } from '@forethread/ui-components';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';

import { STATUS_COLORS, DATE_FORMAT_OPTIONS } from '../constants';

interface VendorRowProps {
  vendor: VendorListItem;
  actions: DotAction[];
  onView?: () => void;
  onEdit?: (userId: string) => void;
}

export function VendorRow({ vendor, actions, onView, onEdit }: VendorRowProps) {
  const { t } = useTranslation('vendors');

  return (
    <tr className="hover:bg-accent/50 transition-colors">
      <td className="px-6 py-4 text-foreground pl-14">{vendor.contactName ?? '\u2014'}</td>
      <td className="px-4 py-4 text-muted-foreground">{vendor.contactEmail ?? '\u2014'}</td>
      <td className="px-4 py-4 text-muted-foreground">{vendor.contactPhone ?? '\u2014'}</td>
      <td className="px-4 py-4">
        <Badge
          className={cn(
            'rounded',
            STATUS_COLORS[vendor.status] ?? 'bg-muted text-muted-foreground',
          )}
        >
          {t(`statuses.${vendor.status}` as 'statuses.INVITED')}
        </Badge>
      </td>
      <td className="px-4 py-4 text-muted-foreground">
        {new Date(vendor.assignedAt).toLocaleDateString('en-US', DATE_FORMAT_OPTIONS)}
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="View"
            onClick={(e) => {
              e.stopPropagation();
              onView?.();
            }}
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          {vendor.userId && (
            <button
              type="button"
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Edit"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(vendor.userId!);
              }}
            >
              <EditIcon className="w-4 h-4" />
            </button>
          )}
          {actions.length > 0 && <DotActionsMenu actions={actions} bordered={false} />}
        </div>
      </td>
    </tr>
  );
}
