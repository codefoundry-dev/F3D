import {
  acceptPurchaseOrder,
  confirmPurchaseOrder,
  type PoDetail,
  type VendorAcceptPoInput,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Alert, Button } from '@forethread/ui-components';
import ClockIcon from '@forethread/ui-components/assets/icons/clock-icon.svg?react';
import CrossCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import MarkWithCircleIcon from '@forethread/ui-components/assets/icons/mark-with-cyrcle.svg?react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { DeclinePoModal } from './DeclinePoModal';

/** Statuses where vendor action buttons should appear */
const ACTIONABLE_STATUSES = ['SENT', 'ACKNOWLEDGED'];

interface PoVendorActionsProps {
  po: PoDetail;
  acceptInput?: VendorAcceptPoInput;
  /** Force column layout (for slide-over panels where viewport breakpoints don't apply) */
  compact?: boolean;
}

export function PoVendorActions({ po, acceptInput, compact }: PoVendorActionsProps) {
  const { t } = useTranslation('purchaseOrders');
  const queryClient = useQueryClient();
  const [showDeclineModal, setShowDeclineModal] = useState(false);

  const invalidatePo = () => {
    void queryClient.invalidateQueries({ queryKey: ['purchase-orders', po.id] });
  };

  const acknowledgeMutation = useMutation({
    mutationFn: () => confirmPurchaseOrder(po.id),
    onSuccess: invalidatePo,
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptPurchaseOrder(po.id, acceptInput),
    onSuccess: invalidatePo,
  });

  if (!ACTIONABLE_STATUSES.includes(po.status)) {
    return null;
  }

  const isAcknowledged = po.status === 'ACKNOWLEDGED';
  const isBusy = acknowledgeMutation.isPending || acceptMutation.isPending;

  return (
    <>
      <div
        className={
          compact
            ? 'flex flex-col gap-4'
            : 'flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4'
        }
      >
        {/* Info alert banner */}
        <Alert variant="info" icon={<ClockIcon className="w-[18px] h-[18px]" />}>
          {t('actions.acknowledgeAlert')}
        </Alert>

        {/* Action buttons */}
        <div className="flex gap-3 items-start shrink-0 flex-wrap">
          <Button
            variant="outline"
            size={compact ? 'sm' : 'lg'}
            className={compact ? 'h-[42px] px-3 gap-1.5 text-sm' : 'h-[42px] text-base'}
            leftIcon={<EyeIcon className="w-[18px] h-[18px]" />}
            onClick={() => acknowledgeMutation.mutate()}
            disabled={isAcknowledged || isBusy}
            isLoading={acknowledgeMutation.isPending}
          >
            {t('actions.acknowledge')}
          </Button>

          <Button
            variant="primary"
            size={compact ? 'sm' : 'lg'}
            className={compact ? 'h-[42px] px-3 gap-1.5 text-sm' : 'h-[42px] text-base'}
            leftIcon={<MarkWithCircleIcon className="w-[18px] h-[18px]" />}
            onClick={() => acceptMutation.mutate()}
            disabled={!isAcknowledged || isBusy}
            isLoading={acceptMutation.isPending}
          >
            {t('actions.approve')}
          </Button>

          <Button
            variant="outline"
            size={compact ? 'sm' : 'lg'}
            className={compact ? 'h-[42px] px-3 gap-1.5 text-sm' : 'h-[42px] text-base'}
            leftIcon={<CrossCircleIcon className="w-[18px] h-[18px]" />}
            onClick={() => setShowDeclineModal(true)}
            disabled={isBusy}
          >
            {t('actions.decline')}
          </Button>
        </div>
      </div>

      {showDeclineModal && (
        <DeclinePoModal poId={po.id} onClose={() => setShowDeclineModal(false)} />
      )}
    </>
  );
}
