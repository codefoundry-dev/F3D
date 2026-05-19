import type { WarehouseBulkOrderItem, WarehousePoItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Badge, PageLoader } from '@forethread/ui-components';
import LocationIcon from '@forethread/ui-components/assets/icons/location.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';

import { useDashboardData } from '../hooks/useDashboardData';

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { data, isLoading } = useDashboardData();

  if (isLoading) return <PageLoader />;

  if (!data) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {t('warehouse.noData', { defaultValue: 'Unable to load dashboard data.' })}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 overflow-auto">
      {/* KPI Cards */}
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

      {/* Pending Deliveries + Recent Deliveries */}
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

      {/* Active Bulk Orders */}
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
    <div className="bg-card rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${accent ? 'text-destructive' : 'text-foreground'}`}>
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
    <div className="bg-card rounded-lg border border-border p-4">
      <h2 className="text-base font-semibold text-foreground mb-3">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">{emptyText}</p>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {items.map((po) => (
            <DeliveryCard key={po.id} item={po} showDeadline={showDeadline} />
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryCard({ item, showDeadline }: { item: WarehousePoItem; showDeadline?: boolean }) {
  const isOverdue = showDeadline && item.deadlineEnd && new Date(item.deadlineEnd) < new Date();

  return (
    <div className="rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors">
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
    <div className="bg-card rounded-lg border border-border p-4">
      <h2 className="text-base font-semibold text-foreground mb-3">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {items.map((bo) => (
            <div key={bo.id} className="rounded-lg border border-border p-4">
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
              {/* Line items fulfillment */}
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
          ))}
        </div>
      )}
    </div>
  );
}
