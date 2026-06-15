import { approvePurchaseOrder } from '@forethread/api-client';
import type { PoDetail } from '@forethread/api-client';
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
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { DeclinePoReasonModal } from '@/features/purchase-orders/buyer/components/DeclinePoReasonModal';

interface AwaitingApprovalSectionProps {
  items: PoDetail[];
  isLoading?: boolean;
}

/**
 * Week-3 approver inbox — the real PENDING_APPROVAL queue the current user is
 * entitled to approve (via {@link listPendingApproval}). Mirrors the
 * PendingPurchaseOrders card UX but sources entitled approvals, not DRAFT/SENT.
 */
export function AwaitingApprovalSection({ items, isLoading }: AwaitingApprovalSectionProps) {
  const { t } = useTranslation('dashboard');

  if (isLoading) {
    return (
      <DashboardSectionSkeleton title={t('awaitingApproval.title', 'Awaiting your approval')} />
    );
  }

  return (
    <div className="bg-white rounded-[14px] border border-black/20 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h2 className="text-lg font-medium text-foreground">
          {t('awaitingApproval.title', 'Awaiting your approval')}
        </h2>
      </div>
      <div className="px-4 pb-4 pt-0.5 space-y-2">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('awaitingApproval.empty', 'No purchase orders awaiting your approval')}
          </p>
        ) : (
          items.map((po) => <ApprovalCard key={po.id} po={po} />)
        )}
      </div>
    </div>
  );
}

function ApprovalCard({ po }: { po: PoDetail }) {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['dashboard', 'awaiting-approval'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard', 'po-ca'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => approvePurchaseOrder(po.id),
    onSuccess: invalidate,
  });

  const [showDeclineModal, setShowDeclineModal] = useState(false);

  const isMutating = approveMutation.isPending;
  const itemCount = po.lineItemCount;

  return (
    <>
      <DashboardItemCard
        name={po.vendor.name}
        onCardClick={() => navigate(ROUTES.purchaseOrderDetail.replace(':id', po.id))}
        hasChat={false}
        statusBadge={
          <Badge className="bg-[#e4e4e4] text-[#262626] border-0 rounded-full text-xs px-2 py-0.5">
            {formatStatus(po.status)}
          </Badge>
        }
        actions={
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
        }
        fields={[
          { icon: <FileTextIcon className="w-[18px] h-[18px]" />, value: po.poNumber },
          { icon: <BriefcaseIcon className="w-[18px] h-[18px]" />, value: po.projectName },
          { icon: <DateIcon className="w-[18px] h-[18px]" />, value: formatDate(po.createdAt) },
          {
            icon: <CoinsIcon className="w-[18px] h-[18px]" />,
            value: formatCurrency(po.totalAmount, po.currency),
          },
          {
            icon: <PackageIcon className="w-[18px] h-[18px]" />,
            value: `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`,
          },
          {
            icon: <LocationIcon className="w-[18px] h-[18px]" />,
            value: po.pickUp
              ? t('awaitingApproval.pickUp', 'Pick-up')
              : t('awaitingApproval.delivery', 'Delivery'),
          },
        ]}
      />
      {showDeclineModal && (
        <DeclinePoReasonModal
          poId={po.id}
          onClose={() => setShowDeclineModal(false)}
          onDeclined={invalidate}
        />
      )}
    </>
  );
}
