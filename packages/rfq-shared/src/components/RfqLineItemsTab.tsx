import type { RfqLineItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { MessageBadgeIcon } from '@forethread/ui-components';
import EditInSquareIcon from '@forethread/ui-components/assets/icons/edit-in-square.svg?react';

import { formatDate } from './detail-primitives';

interface RfqLineItemsTabProps {
  lineItems: RfqLineItem[];
  layout?: 'panel' | 'page';
}

export function RfqLineItemsTab({ lineItems, layout = 'panel' }: RfqLineItemsTabProps) {
  const { t } = useTranslation('rfqs');

  return (
    <div>
      {layout === 'page' && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium text-foreground">{t('lineItemsTab.title')}</h2>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left">
              <th className="pb-2 pr-3 font-medium text-muted-foreground text-xs">
                {t('lineItemsTab.project')}
              </th>
              <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
                {t('lineItemsTab.lineItemId')}
              </th>
              <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
                {t('lineItemsTab.materialName')}
              </th>
              <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
                {t('lineItemsTab.description')}
              </th>
              <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
                {t('lineItemsTab.qtyOrdered')}
              </th>
              <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
                {t('lineItemsTab.uom')}
              </th>
              <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
                {t('lineItemsTab.expDeliveryDate')}
              </th>
              <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
                {t('lineItemsTab.deliveryLocation')}
              </th>
              <th className="pb-2 pl-3 font-medium text-muted-foreground text-xs text-center">
                {t('lineItemsTab.notesIndicator')}
              </th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item) => (
              <tr key={item.id} className="border-b border-foreground/10">
                <td className="py-2.5 pr-3 text-foreground">{item.projectName}</td>
                <td className="py-2.5 px-3 text-foreground">{item.id}</td>
                <td className="py-2.5 px-3 text-foreground">{item.materialName}</td>
                <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[160px]">
                  {item.description ?? '-'}
                </td>
                <td className="py-2.5 px-3 text-foreground">{item.quantity}</td>
                <td className="py-2.5 px-3 text-muted-foreground">{item.unit}</td>
                <td className="py-2.5 px-3 text-muted-foreground">
                  {formatDate(item.expectedDeliveryDate)}
                </td>
                <td className="py-2.5 px-3 text-muted-foreground">
                  {item.deliveryLocation ?? '-'}
                </td>
                <td className="py-2.5 pl-3 text-center">
                  <MessageBadgeIcon
                    hasNotification={!!item.hasNotes}
                    icon={<EditInSquareIcon className="w-4 h-4 block" />}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-start mt-3 pt-3 border-t border-foreground/10">
        <span className="text-sm text-muted-foreground">
          {t('lineItemsTab.totalItems')}:{' '}
          <span className="font-medium text-foreground">{lineItems.length}</span>
        </span>
      </div>
    </div>
  );
}
