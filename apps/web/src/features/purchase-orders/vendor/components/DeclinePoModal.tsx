import { declinePublicPurchaseOrder, vendorDeclinePurchaseOrder } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
  Button,
} from '@forethread/ui-components';
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
    <Modal onClose={onClose}>
      <ModalHeader onClose={onClose}>{t('decline.title', 'Decline Purchase Order')}</ModalHeader>
      <ModalBody>
        <p className="text-sm text-muted-foreground mb-4">
          {t(
            'decline.description',
            'Are you sure you want to decline this purchase order? Please provide a reason.',
          )}
        </p>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('decline.reasonPlaceholder', 'Enter reason for declining...')}
          rows={4}
        />
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
          {t('decline.cancel', 'Cancel')}
        </Button>
        <Button
          variant="destructive"
          onClick={() => mutation.mutate()}
          isLoading={mutation.isPending}
        >
          {t('decline.confirm', 'Decline PO')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
