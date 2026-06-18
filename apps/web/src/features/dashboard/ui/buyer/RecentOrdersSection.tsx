import type { RecentOrderItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Badge,
  DashboardItemCard,
  DashboardSectionSkeleton,
  formatCurrency,
  formatStatus,
} from '@forethread/ui-components';
import type { MetadataField } from '@forethread/ui-components';
import BriefcaseIcon from '@forethread/ui-components/assets/icons/briefcase.svg?react';
import CoinsIcon from '@forethread/ui-components/assets/icons/coins.svg?react';
import DateIcon from '@forethread/ui-components/assets/icons/date.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import LocationIcon from '@forethread/ui-components/assets/icons/location.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import UsersGroupIcon from '@forethread/ui-components/assets/icons/users-group.svg?react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

interface RecentOrdersSectionProps {
  items: RecentOrderItem[];
  isLoading?: boolean;
}

const ICON = 'w-[18px] h-[18px]';

function formatOrderId(item: RecentOrderItem): string {
  const prefixes: Record<string, string> = {
    rfq: 'RFQ',
    po: 'PO',
    'bulk-order': 'BULK',
  };
  const prefix = prefixes[item.type] ?? item.type.toUpperCase();
  return `${prefix}-${item.id.slice(0, 8)}`;
}

/** Per-type metadata fields, mirroring the frame's RFQ / PO / BULK card variants. */
function buildFields(item: RecentOrderItem): MetadataField[] {
  const fields: MetadataField[] = [
    { icon: <BriefcaseIcon className={ICON} />, value: item.projectName },
  ];

  if (item.vendorName) {
    fields.push({ icon: <UsersGroupIcon className={ICON} />, value: item.vendorName });
  } else if (item.location) {
    fields.push({ icon: <LocationIcon className={ICON} />, value: item.location });
  }

  if (item.dateRange) {
    fields.push({ icon: <DateIcon className={ICON} />, value: item.dateRange });
  }
  if (item.itemCount > 0) {
    fields.push({
      icon: <PackageIcon className={ICON} />,
      value: `${item.itemCount} ${item.itemCount === 1 ? 'item' : 'items'}`,
    });
  }
  if (item.totalCost !== null) {
    fields.push({ icon: <CoinsIcon className={ICON} />, value: formatCurrency(item.totalCost) });
  }
  if (item.remainingPercent !== null) {
    fields.push({
      icon: <PackageIcon className={ICON} />,
      value: `Remaining ${item.remainingPercent}%`,
    });
  } else if (item.vendorName && item.location) {
    // PO variant: show the delivery/pick-up location after vendor.
    fields.push({ icon: <LocationIcon className={ICON} />, value: item.location });
  }

  return fields;
}

export function RecentOrdersSection({ items, isLoading }: RecentOrdersSectionProps) {
  const { t } = useTranslation('dashboard');

  if (isLoading) {
    return <DashboardSectionSkeleton title={t('recentOrders.title')} />;
  }

  return (
    <div className="bg-white rounded-[14px] border border-black/20 overflow-hidden flex flex-col h-[420px]">
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-base font-semibold text-foreground">{t('recentOrders.title')}</h2>
      </div>
      <div className="px-4 pb-4 pt-0.5 flex-1 overflow-y-auto space-y-2">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('recentOrders.noOrders')}
          </p>
        ) : (
          items.map((item) => <RecentOrderCard key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}

function RecentOrderCard({ item }: { item: RecentOrderItem }) {
  const navigate = useNavigate();

  function handleViewClick() {
    const routeMap: Record<string, string> = {
      rfq: ROUTES.rfqDetail,
      po: ROUTES.purchaseOrderDetail,
      'bulk-order': ROUTES.bulkOrderDetail,
    };
    const route = routeMap[item.type];
    if (route) {
      navigate(route.replace(':id', item.id));
    }
  }

  return (
    <DashboardItemCard
      name={formatOrderId(item)}
      onCardClick={handleViewClick}
      hasChatNotification={item.hasMessages}
      statusBadge={
        <Badge className="bg-[#e4e4e4] text-[#262626] border-0 rounded-full text-xs px-2 py-0.5">
          {formatStatus(item.status)}
        </Badge>
      }
      actions={
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          onClick={handleViewClick}
          aria-label="View order"
        >
          <EyeIcon className="w-4 h-4" />
        </button>
      }
      fields={buildFields(item)}
    />
  );
}
