import { useTranslation } from '@forethread/i18n';

const TH_CLASS = 'px-3 py-2.5 text-xs font-bold tracking-wide border-b border-r border-border';
const TH_LAST = 'px-3 py-2.5 text-xs font-bold tracking-wide border-b border-border';

interface LineItemsTableHeaderProps {
  /**
   * US 5.09 drawdown: render an "Available qty" column in place of the
   * "Appr. RFQ"/"Bulk orders" validation columns.
   */
  isDrawdownMode?: boolean;
}

export function LineItemsTableHeader({ isDrawdownMode = false }: LineItemsTableHeaderProps) {
  const { t } = useTranslation('purchaseOrders');

  return (
    <thead>
      <tr className="text-left bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))]">
        <th className={TH_CLASS} style={{ width: '15%' }}>
          {t('create.materialName')}
        </th>
        <th className={TH_CLASS} style={{ width: '10%' }}>
          {t('create.materialCode')}
        </th>
        <th className={TH_CLASS} style={{ width: '8%' }}>
          {t('create.costCode')}
        </th>
        <th className={TH_CLASS} style={{ width: '7%' }}>
          {t('create.uom')}
        </th>
        <th className={TH_CLASS} style={{ width: '9%' }}>
          {t('create.pricePerUnit')}
        </th>
        <th className={TH_CLASS} style={{ width: '8%' }}>
          {t('create.qtyOrdered')}
        </th>
        {isDrawdownMode ? (
          <th className={TH_CLASS} style={{ width: '12%' }}>
            {t('create.availableQty')}
          </th>
        ) : (
          <>
            <th className={TH_CLASS} style={{ width: '8%' }}>
              {t('create.approvedRfq')}
            </th>
            <th className={TH_CLASS} style={{ width: '8%' }}>
              {t('create.bulkOrders')}
            </th>
          </>
        )}
        <th className={TH_CLASS} style={{ width: '10%' }}>
          {t('create.expDeliveryDate')}
        </th>
        <th className={TH_CLASS} style={{ width: '10%' }}>
          {t('create.deliveryLocationCol')}
        </th>
        <th className={TH_LAST} style={{ width: '7%' }}>
          {t('create.actionsCol')}
        </th>
      </tr>
    </thead>
  );
}
