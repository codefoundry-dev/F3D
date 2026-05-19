import { vendorDeclinePurchaseOrder } from '@forethread/api-client';
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
  onClose: () => void;
}

export function DeclinePoModal({ poId, onClose }: DeclinePoModalProps) {
  const { t } = useTranslation('purchaseOrders');
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => vendorDeclinePurchaseOrder(poId, { reason: reason.trim() || undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
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
