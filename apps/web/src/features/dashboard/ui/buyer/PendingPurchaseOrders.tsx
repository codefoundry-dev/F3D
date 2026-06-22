import { approvePurchaseOrder } from '@forethread/api-client';
import type { PendingPoItem, PoDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Badge,
  DashboardItemCard,
  DashboardSectionSkeleton,
  formatCurrency,
  formatDate,
  formatStatus,
} from '@forethread/ui-components';
import BriefcaseIcon from '@forethread/ui-components/assets/icons/briefcase.svg?react';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import CoinsIcon from '@forethread/ui-components/assets/icons/coins.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import DateIcon from '@forethread/ui-components/assets/icons/date.svg?react';
import FileTextIcon from '@forethread/ui-components/assets/icons/file-text.svg?react';
import LocationIcon from '@forethread/ui-components/assets/icons/location.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { DeclinePoReasonModal } from '@/features/purchase-orders/buyer/components/DeclinePoReasonModal';

/**
 * Normalised shape rendered by a Purchase orders card. The section draws from two
 * sources: the dashboard's DRAFT/SENT pending POs ({@link PendingPoItem}) and — for
 * approvers — the entitled PENDING_APPROVAL queue ({@link PoDetail} via
 * `listPendingApproval`). Both collapse into this shape so the cards are identical.
 */
interface PoCardData {
  id: string;
  vendorName: string;
  poNumber: string;
  projectName: string;
  date: string;
  totalCost: number | null;
  currency?: string;
  itemCount: number;
  deliveryType: string;
  status: string;
  hasUnreadMessages?: boolean;
  hasAttachments?: boolean;
}

interface PendingPurchaseOrdersProps {
  items: PendingPoItem[];
  isLoading?: boolean;
  /** Whether the current user holds `po.approve` (gates the Decline/Approve actions). */
  canApprove?: boolean;
  /** Entitled PENDING_APPROVAL queue (only fetched for approvers). */
  approvalItems?: PoDetail[];
  isLoadingApproval?: boolean;
}

type TabFilter = 'all' | 'pending' | 'acknowledged';

function fromPendingPoItem(item: PendingPoItem): PoCardData {
  return {
    id: item.id,
    vendorName: item.vendorName,
    poNumber: item.poNumber,
    projectName: item.projectName,
    date: item.date,
    totalCost: item.totalCost,
    itemCount: item.itemCount,
    deliveryType: item.deliveryType,
    status: item.status,
    hasUnreadMessages: item.hasUnreadMessages,
    hasAttachments: item.hasAttachments,
  };
}

function fromPoDetail(po: PoDetail, pickUpLabel: string, deliveryLabel: string): PoCardData {
  return {
    id: po.id,
    vendorName: po.vendor?.name ?? '-',
    poNumber: po.poNumber,
    projectName: po.projectName,
    date: formatDate(po.createdAt),
    totalCost: po.totalAmount,
    currency: po.currency,
    itemCount: po.lineItemCount,
    deliveryType: po.pickUp ? pickUpLabel : deliveryLabel,
    status: po.status,
  };
}

export function PendingPurchaseOrders({
  items,
  isLoading,
  canApprove = false,
  approvalItems = [],
  isLoadingApproval = false,
}: PendingPurchaseOrdersProps) {
  const { t } = useTranslation('dashboard');
  const [activeTab, setActiveTab] = useState<TabFilter>('all');

  const pickUpLabel = t('awaitingApproval.pickUp', 'Pick-up');
  const deliveryLabel = t('awaitingApproval.delivery', 'Delivery');

  // Merge the entitled approval queue (for approvers) ahead of the dashboard's
  // DRAFT/SENT pending POs, de-duplicating by id so a PO that appears in both
  // sources renders once.
  const cards = useMemo<PoCardData[]>(() => {
    const approvalCards = canApprove
      ? approvalItems.map((po) => fromPoDetail(po, pickUpLabel, deliveryLabel))
      : [];
    const seen = new Set(approvalCards.map((c) => c.id));
    const pendingCards = items.filter((i) => !seen.has(i.id)).map(fromPendingPoItem);
    return [...approvalCards, ...pendingCards];
  }, [items, approvalItems, canApprove, pickUpLabel, deliveryLabel]);

  const filteredItems =
    activeTab === 'all' ? cards : cards.filter((item) => item.status.toLowerCase() === activeTab);

  if (isLoading || (canApprove && isLoadingApproval)) {
    return <DashboardSectionSkeleton title={t('purchaseOrders.title')} />;
  }

  return (
    <div className="bg-white rounded-[14px] border border-black/20 overflow-hidden flex flex-col h-[420px]">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h2 className="text-base font-semibold text-foreground">{t('purchaseOrders.title')}</h2>
        <div className="flex gap-2">
          {(['all', 'pending', 'acknowledged'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-2.5 py-1 text-sm font-normal transition-colors ${
                activeTab === tab
                  ? 'bg-accent text-foreground'
                  : 'border border-border text-foreground hover:bg-accent/50'
              }`}
            >
              {t(`purchaseOrders.${tab}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 pb-4 pt-0.5 flex-1 overflow-auto space-y-2">
        {filteredItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('purchaseOrders.noPOs')}
          </p>
        ) : (
          filteredItems.map((item) => <PoCard key={item.id} item={item} canApprove={canApprove} />)
        )}
      </div>
    </div>
  );
}

function PoCard({ item, canApprove }: { item: PoCardData; canApprove: boolean }) {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['dashboard', 'po-ca'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard', 'awaiting-approval'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => approvePurchaseOrder(item.id),
    onSuccess: invalidate,
  });

  const [showDeclineModal, setShowDeclineModal] = useState(false);

  const isMutating = approveMutation.isPending;

  return (
    <>
      <DashboardItemCard
        name={item.vendorName}
        onCardClick={() => navigate(ROUTES.purchaseOrderDetail.replace(':id', item.id))}
        hasChatNotification={item.hasUnreadMessages}
        hasAttachment={item.hasAttachments ?? false}
        onMessageClick={() =>
          navigate(`${ROUTES.purchaseOrderDetail.replace(':id', item.id)}?tab=messages`)
        }
        onAttachmentClick={() =>
          navigate(`${ROUTES.purchaseOrderDetail.replace(':id', item.id)}?tab=documents`)
        }
        statusBadge={
          <Badge className="bg-[#E8EAED] text-[#2D3139] border-0 rounded-full text-xs px-2 py-0.5">
            {formatStatus(item.status)}
          </Badge>
        }
        actions={
          canApprove ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex items-center gap-1.5 h-8 px-3 py-2 border border-black rounded-xl text-sm font-medium text-black hover:bg-black/5 transition-colors disabled:opacity-50"
                disabled={isMutating}
                onClick={() => setShowDeclineModal(true)}
              >
                <CrossInCircleIcon className="w-[18px] h-[18px]" />
                {t('purchaseOrders.decline')}
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 h-8 px-3 py-2 border border-black rounded-xl text-sm font-medium text-black hover:bg-black/5 transition-colors disabled:opacity-50"
                disabled={isMutating}
                onClick={() => approveMutation.mutate()}
              >
                <CheckCircleIcon className="w-[18px] h-[18px]" />
                {t('purchaseOrders.approve')}
              </button>
            </div>
          ) : undefined
        }
        fields={[
          { icon: <FileTextIcon className="w-[18px] h-[18px]" />, value: item.poNumber },
          { icon: <BriefcaseIcon className="w-[18px] h-[18px]" />, value: item.projectName },
          { icon: <DateIcon className="w-[18px] h-[18px]" />, value: item.date },
          {
            icon: <CoinsIcon className="w-[18px] h-[18px]" />,
            value: formatCurrency(item.totalCost, item.currency),
          },
          {
            icon: <PackageIcon className="w-[18px] h-[18px]" />,
            value: `${item.itemCount} ${item.itemCount === 1 ? 'item' : 'items'}`,
          },
          { icon: <LocationIcon className="w-[18px] h-[18px]" />, value: item.deliveryType },
        ]}
      />
      {showDeclineModal && (
        <DeclinePoReasonModal
          poId={item.id}
          onClose={() => setShowDeclineModal(false)}
          onDeclined={invalidate}
        />
      )}
    </>
  );
}
