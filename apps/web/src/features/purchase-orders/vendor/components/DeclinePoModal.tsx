import { declinePublicPurchaseOrder, vendorDeclinePurchaseOrder } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { GridModal, Textarea, Button } from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface DeclinePoModalProps {
  poId: string;
  /** Guest portal token (FOR-247): when set, decline via the public token endpoint. */
  token?: string;
  onClose: () => void;
}

export function DeclinePoModal({ poId, token, onClose }: DeclinePoModalProps) {
  const { t } = useTranslation('purchaseOrders');
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const body = { reason: reason.trim() || undefined };
      if (token) await declinePublicPurchaseOrder(token, body);
      else await vendorDeclinePurchaseOrder(poId, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: token ? ['guest-po', token] : ['purchase-orders'],
      });
      onClose();
    },
  });

  return (
    <GridModal
      onClose={onClose}
      icon={<CrossInCircleIcon className="size-6 text-destructive" />}
      title={t('decline.title', 'Decline Purchase Order')}
      description={t(
        'decline.description',
        'Are you sure you want to decline this purchase order? Please provide a reason.',
      )}
      actions={
        <>
          <Button
            variant="destructive"
            size="lg"
            onClick={() => mutation.mutate()}
            isLoading={mutation.isPending}
            className="w-full"
          >
            {t('decline.confirm', 'Decline PO')}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onClose}
            disabled={mutation.isPending}
            className="w-full"
          >
            {t('decline.cancel', 'Cancel')}
          </Button>
        </>
      }
    >
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('decline.reasonPlaceholder', 'Enter reason for declining...')}
        rows={4}
      />
    </GridModal>
  );
}
