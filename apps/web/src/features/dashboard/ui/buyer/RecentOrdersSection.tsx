import type { RecentOrderItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Badge,
  formatCurrency,
  formatStatus,
  getStatusColor,
  MessageBadgeIcon,
  ORDER_STATUS_COLORS,
} from '@forethread/ui-components';
import CoinsIcon from '@forethread/ui-components/assets/icons/coins.svg?react';
import DateIcon from '@forethread/ui-components/assets/icons/date.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import LocationIcon from '@forethread/ui-components/assets/icons/location.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import ProjectsIcon from '@forethread/ui-components/assets/icons/projects.svg?react';
import UsersGroupIcon from '@forethread/ui-components/assets/icons/users-group.svg?react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

interface RecentOrdersSectionProps {
  items: RecentOrderItem[];
  isLoading?: boolean;
}

function formatOrderId(item: RecentOrderItem): string {
  const prefixes: Record<string, string> = {
    rfq: 'RFQ',
    po: 'PO',
    'bulk-order': 'BULK',
  };
  const prefix = prefixes[item.type] ?? item.type.toUpperCase();
  return `${prefix}-${item.id.slice(0, 8)}`;
}

export function RecentOrdersSection({ items, isLoading }: RecentOrdersSectionProps) {
  const { t } = useTranslation('dashboard');

  if (isLoading) {
    return <SectionSkeleton title={t('recentOrders.title')} />;
  }

  return (
    <div className="rounded-2xl border border-border/20 bg-card h-[420px] flex flex-col">
      <div className="border-b border-border/20 px-4 py-3">
        <h2 className="text-lg font-medium text-foreground">{t('recentOrders.title')}</h2>
      </div>
      <div className="p-4 space-y-2 flex-1 overflow-y-auto">
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
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();

  // Buyer purchase orders read the documented lifecycle vocabulary; RFQ and bulk
  // rows keep the generic prettifier (governed by their own tickets).
  const statusLabel =
    item.type === 'po'
      ? t(`purchaseOrders:buyerStatus.${item.status}` as never)
      : formatStatus(item.status);

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
    <div
      className="rounded-lg border border-border p-3 space-y-2 cursor-pointer transition-[box-shadow,border-color] hover:border-border-hover hover:ring-1 hover:ring-border-hover"
      onClick={handleViewClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleViewClick();
        }
      }}
    >
      {/* Row 1: Order ID + Status + flag/eye icons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{formatOrderId(item)}</span>
          <Badge className={getStatusColor(ORDER_STATUS_COLORS, item.status)}>{statusLabel}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <MessageBadgeIcon hasNotification={item.hasMessages} className="text-muted-foreground" />
          <button
            type="button"
            className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            onClick={handleViewClick}
          >
            <EyeIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Row 2: Project name, Location/Vendor, Date */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1 truncate">
          <ProjectsIcon className="h-3 w-3 shrink-0" />
          {item.projectName}
        </span>
        {item.location && (
          <span className="flex items-center gap-1 truncate">
            <LocationIcon className="h-3 w-3 shrink-0" />
            {item.location}
          </span>
        )}
        {item.vendorName && (
          <span className="flex items-center gap-1 truncate">
            <UsersGroupIcon className="h-3 w-3 shrink-0" />
            {item.vendorName}
          </span>
        )}
        {item.dateRange && (
          <span className="flex items-center gap-1 ml-auto shrink-0">
            <DateIcon className="h-3 w-3 shrink-0" />
            {item.dateRange}
          </span>
        )}
      </div>

      {/* Row 3: Items, Cost, Remaining */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {item.itemCount > 0 && (
          <span className="flex items-center gap-1">
            <PackageIcon className="h-3 w-3 shrink-0" />
            {item.itemCount} {item.itemCount === 1 ? 'item' : 'items'}
          </span>
        )}
        {item.totalCost !== null && item.totalCost !== undefined && (
          <span className="flex items-center gap-1">
            <CoinsIcon className="h-3 w-3 shrink-0" />
            {formatCurrency(item.totalCost)}
          </span>
        )}
        {item.remainingPercent !== null && item.remainingPercent !== undefined && (
          <span className="ml-auto shrink-0">Remaining quantity {item.remainingPercent}%</span>
        )}
      </div>
    </div>
  );
}

function SectionSkeleton({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-border/20 bg-card">
      <div className="border-b border-border/20 px-4 py-3">
        <h2 className="text-lg font-medium text-foreground">{title}</h2>
      </div>
      <div className="p-4 space-y-2">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
