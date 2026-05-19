import { useTranslation } from '@forethread/i18n';

const TH_CLASS = 'px-3 py-2.5 text-xs font-bold tracking-wide border-b border-r border-border';
const TH_LAST = 'px-3 py-2.5 text-xs font-bold tracking-wide border-b border-border';

export function LineItemsTableHeader() {
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
        <th className={TH_CLASS} style={{ width: '8%' }}>
          {t('create.approvedRfq')}
        </th>
        <th className={TH_CLASS} style={{ width: '8%' }}>
          {t('create.bulkOrders')}
        </th>
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
