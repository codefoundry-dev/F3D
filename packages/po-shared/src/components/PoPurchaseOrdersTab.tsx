import type { PoListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Badge, MessageBadgeIcon, Spinner } from '@forethread/ui-components';
import CoinsIcon from '@forethread/ui-components/assets/icons/coins.svg?react';
import DateIcon from '@forethread/ui-components/assets/icons/date.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import PaperclipIcon from '@forethread/ui-components/assets/icons/paperclip.svg?react';
import { useNavigate } from 'react-router-dom';

import { formatCurrency, formatDate, formatStatus } from '@forethread/ui-components';

import { usePurchaseOrders } from '../hooks/usePurchaseOrders';

interface PoPurchaseOrdersTabProps {
  layout?: 'page' | 'panel';
  detailRoute: string;
  commsRoute: string;
}

export function PoPurchaseOrdersTab({
  layout = 'page',
  detailRoute,
  commsRoute,
}: PoPurchaseOrdersTabProps) {
  const { t } = useTranslation('purchaseOrders');
  const navigate = useNavigate();
  const { data, isLoading } = usePurchaseOrders();
  const items = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t('purchaseOrdersTab.noItems')}
      </p>
    );
  }

  return (
    <div className={layout === 'panel' ? 'space-y-3' : 'space-y-4'}>
      <div className="space-y-3">
        {items.map((po) => (
          <PoCard
            key={po.id}
            po={po}
            detailRoute={detailRoute}
            commsRoute={commsRoute}
            navigate={navigate}
          />
        ))}
      </div>
    </div>
  );
}

function PoCard({
  po,
  detailRoute,
  commsRoute,
  navigate,
}: {
  po: PoListItem;
  detailRoute: string;
  commsRoute: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <div
      className="rounded-lg border border-border p-4 cursor-pointer hover:border-border-hover hover:ring-1 hover:ring-border-hover transition-[box-shadow,border-color]"
      onClick={() => navigate(`${detailRoute.replace(':id', po.id)}?tab=details`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`${detailRoute.replace(':id', po.id)}?tab=details`);
        }
      }}
    >
      {/* Header: vendor name + status */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          {po.vendorName ?? po.poNumber ?? po.id}
        </span>
        <Badge className="bg-[#E8EAED] text-[#2D3139] border-0 rounded-full text-xs px-2 py-0.5">
          {formatStatus(po.status)}
        </Badge>
      </div>

      {/* Metadata */}
      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5">
        <MetaField
          icon={<CoinsIcon className="w-4 h-4" />}
          value={formatCurrency(po.totalAmount, po.currency)}
        />
        <MetaField
          icon={<PackageIcon className="w-4 h-4" />}
          value={`${po.lineItemCount} ${po.lineItemCount === 1 ? 'item' : 'items'}`}
        />
        <MetaField icon={<DateIcon className="w-4 h-4" />} value={formatDate(po.createdDate)} />
      </div>

      {/* Footer: icons */}
      <div className="mt-3 flex items-center justify-end">
        <div
          className="flex items-center gap-1"
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <MessageBadgeIcon
            hasNotification={po.hasMessages}
            onClick={() => navigate(`${commsRoute.replace(':id', po.id)}?tab=messages`)}
          />
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            onClick={() => navigate(`${commsRoute.replace(':id', po.id)}?tab=attachments`)}
          >
            <PaperclipIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MetaField({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="shrink-0 w-4 h-4 flex items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="text-sm font-medium text-foreground truncate">{value}</span>
    </div>
  );
}
