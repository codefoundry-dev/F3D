import {
  acceptPublicPurchaseOrder,
  acceptPurchaseOrder,
  confirmPublicPurchaseOrder,
  confirmPurchaseOrder,
  type PoDetail,
  type VendorAcceptPoInput,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Alert, Button, MobileActionBar, useIsPhone } from '@forethread/ui-components';
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
  /**
   * Tokenised guest portal token (FOR-247). When set, the actions go through the
   * public token-authorised endpoints (no login) instead of the authenticated
   * id-based ones — the same component drives both the activated-vendor PO detail
   * page and the Unactivated-Vendor portal link.
   */
  token?: string;
}

export function PoVendorActions({ po, acceptInput, compact, token }: PoVendorActionsProps) {
  const { t } = useTranslation('purchaseOrders');
  const queryClient = useQueryClient();
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  // Phones (not slide-over panels): the buttons move to the fixed footer bar (B7).
  const inBar = useIsPhone() && !compact;

  const invalidatePo = () => {
    // The guest portal keys its PO query on the token; the authenticated detail
    // page keys it on the PO id. Invalidate whichever is in play.
    void queryClient.invalidateQueries({
      queryKey: token ? ['guest-po', token] : ['purchase-orders', po.id],
    });
  };

  const acknowledgeMutation = useMutation({
    mutationFn: async () => {
      if (token) await confirmPublicPurchaseOrder(token);
      else await confirmPurchaseOrder(po.id);
    },
    onSuccess: invalidatePo,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (token) await acceptPublicPurchaseOrder(token, acceptInput);
      else await acceptPurchaseOrder(po.id, acceptInput);
    },
    onSuccess: invalidatePo,
  });

  if (!ACTIONABLE_STATUSES.includes(po.status)) {
    return null;
  }

  const isAcknowledged = po.status === 'ACKNOWLEDGED';
  const isBusy = acknowledgeMutation.isPending || acceptMutation.isPending;

  const btnSize = compact ? 'sm' : 'lg';
  const btnClass = compact ? 'h-[42px] px-3 gap-1.5 text-sm' : 'h-[42px] text-base';
  const acknowledgeButton = (
    <Button
      variant="outline"
      size={btnSize}
      className={btnClass}
      leftIcon={<EyeIcon className="w-[18px] h-[18px]" />}
      onClick={() => acknowledgeMutation.mutate()}
      disabled={isAcknowledged || isBusy}
      isLoading={acknowledgeMutation.isPending}
    >
      {t('actions.acknowledge')}
    </Button>
  );
  const acceptButton = (
    <Button
      variant="primary"
      size={btnSize}
      className={btnClass}
      leftIcon={<MarkWithCircleIcon className="w-[18px] h-[18px]" />}
      onClick={() => acceptMutation.mutate()}
      disabled={!isAcknowledged || isBusy}
      isLoading={acceptMutation.isPending}
    >
      {t('actions.approve')}
    </Button>
  );
  const declineButton = (
    <Button
      variant="outline"
      size={btnSize}
      className={btnClass}
      leftIcon={<CrossCircleIcon className="w-[18px] h-[18px]" />}
      onClick={() => setShowDeclineModal(true)}
      disabled={isBusy}
    >
      {t('actions.decline')}
    </Button>
  );

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
        {!inBar && (
          <div className="flex gap-3 items-start shrink-0 flex-wrap">
            {acknowledgeButton}
            {acceptButton}
            {declineButton}
          </div>
        )}
      </div>

      {/* Phones: Acknowledge (or Accept once acknowledged) beside Decline, 50/50. */}
      {inBar && (
        <MobileActionBar>
          {isAcknowledged ? acceptButton : acknowledgeButton}
          {declineButton}
        </MobileActionBar>
      )}

      {showDeclineModal && (
        <DeclinePoModal poId={po.id} token={token} onClose={() => setShowDeclineModal(false)} />
      )}
    </>
  );
}
