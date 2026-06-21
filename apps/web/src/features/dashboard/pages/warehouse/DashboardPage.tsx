import type { WarehouseBulkOrderItem, WarehousePoItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { Badge, DashboardSection, PageLoader } from '@forethread/ui-components';
import LocationIcon from '@forethread/ui-components/assets/icons/location.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import { useEffect } from 'react';

import { useDashboardData } from '../../hooks/warehouse/useDashboardData';

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { data, isLoading } = useDashboardData();

  // Warehouse lands on `/`, so this dashboard owns the global header copy.
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(
      t('warehouse.title', { defaultValue: 'Warehouse dashboard' }),
      t('warehouse.subtitle', { defaultValue: 'Track deliveries and bulk-order fulfilment' }),
    );
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  if (isLoading) return <PageLoader />;

  if (!data) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {t('warehouse.noData', { defaultValue: 'Unable to load dashboard data.' })}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title={t('warehouse.kpi.pendingDeliveries', { defaultValue: 'Pending Deliveries' })}
          value={data.kpi.pendingDeliveries}
          accent={data.kpi.overdueDeliveries > 0}
        />
        <KpiCard
          title={t('warehouse.kpi.overdueDeliveries', { defaultValue: 'Overdue' })}
          value={data.kpi.overdueDeliveries}
          accent={data.kpi.overdueDeliveries > 0}
        />
        <KpiCard
          title={t('warehouse.kpi.delivered', { defaultValue: 'Recently Delivered' })}
          value={data.kpi.delivered}
        />
        <KpiCard
          title={t('warehouse.kpi.activeBulkOrders', { defaultValue: 'Active Bulk Orders' })}
          value={data.kpi.activeBulkOrders}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DeliverySection
          title={t('warehouse.pendingDeliveries', { defaultValue: 'Pending Deliveries' })}
          items={data.pendingDeliveries}
          emptyText={t('warehouse.noPendingDeliveries', { defaultValue: 'No pending deliveries.' })}
          showDeadline
        />
        <DeliverySection
          title={t('warehouse.recentDeliveries', { defaultValue: 'Recent Deliveries' })}
          items={data.recentDeliveries}
          emptyText={t('warehouse.noRecentDeliveries', { defaultValue: 'No recent deliveries.' })}
        />
      </div>

      <BulkOrdersSection
        title={t('warehouse.activeBulkOrders', { defaultValue: 'Active Bulk Orders' })}
        items={data.activeBulkOrders}
        emptyText={t('warehouse.noBulkOrders', { defaultValue: 'No active bulk orders.' })}
      />
    </div>
  );
}

function KpiCard({ title, value, accent }: { title: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-[14px] border-[0.8px] border-black/20 bg-white px-[16.8px] py-[12.8px]">
      <p className="text-sm font-medium leading-5 text-[#525866]">{title}</p>
      <p
        className={`mt-1 text-2xl font-normal leading-8 ${accent ? 'text-destructive' : 'text-foreground'}`}
      >
        {value}
      </p>
    </div>
  );
}

function DeliverySection({
  title,
  items,
  emptyText,
  showDeadline,
}: {
  title: string;
  items: WarehousePoItem[];
  emptyText: string;
  showDeadline?: boolean;
}) {
  return (
    <DashboardSection title={title} maxHeight={400}>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        items.map((po) => <DeliveryCard key={po.id} item={po} showDeadline={showDeadline} />)
      )}
    </DashboardSection>
  );
}

function DeliveryCard({ item, showDeadline }: { item: WarehousePoItem; showDeadline?: boolean }) {
  const isOverdue = showDeadline && item.deadlineEnd && new Date(item.deadlineEnd) < new Date();

  return (
    <div className="rounded-xl border border-black/10 bg-white p-3 transition-colors hover:bg-accent/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground">{item.poNumber}</span>
        <Badge
          className={`text-xs ${isOverdue ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}
        >
          {item.status}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{item.projectName}</p>
      <p className="text-xs text-muted-foreground mt-1">
        {item.vendorName}
        {item.requester && ` · ${item.requester}`}
      </p>
      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <PackageIcon className="w-3 h-3" />
          {item.itemCount} items
        </span>
        {item.deliveryLocation && (
          <span className="flex items-center gap-1">
            <LocationIcon className="w-3 h-3" />
            {item.deliveryLocation}
          </span>
        )}
        {showDeadline && item.deadlineEnd && (
          <span className={isOverdue ? 'text-destructive font-medium' : ''}>
            Due: {new Date(item.deadlineEnd).toLocaleDateString('en-AU')}
          </span>
        )}
      </div>
      {item.totalAmount !== null && (
        <p className="text-sm font-medium text-foreground mt-2">
          ${item.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
      )}
    </div>
  );
}

function BulkOrdersSection({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: WarehouseBulkOrderItem[];
  emptyText: string;
}) {
  return (
    <DashboardSection title={title}>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        items.map((bo) => (
          <div key={bo.id} className="rounded-xl border border-black/10 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">{bo.projectName}</span>
              <Badge className="text-xs bg-muted text-muted-foreground">{bo.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{bo.vendorName}</p>
            {bo.totalAmount !== null && (
              <p className="text-sm font-medium text-foreground mt-1">
                ${bo.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            )}
            {bo.lineItems.length > 0 && (
              <div className="mt-3 space-y-2">
                {bo.lineItems.map((li, idx) => {
                  const pct = Math.round(li.deliveriesPercent);
                  return (
                    <div key={idx} className="text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground truncate mr-2">
                          {li.description}
                        </span>
                        <span className="text-foreground font-medium shrink-0">
                          {li.qty - li.qtyRemaining}/{li.qty} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-foreground rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))
      )}
    </DashboardSection>
  );
}
