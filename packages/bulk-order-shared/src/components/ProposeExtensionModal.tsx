import { useTranslation } from '@forethread/i18n';
import {
  Alert,
  Button,
  DatePicker,
  FormField,
  IconBadge,
  Modal,
  ModalBody,
  ModalCloseButton,
  Textarea,
  formatDate,
  notificationService,
} from '@forethread/ui-components';
import FileIcon from '@forethread/ui-components/assets/icons/file-text.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info-in-triangle.svg?react';
import { useState } from 'react';

import { useProposeChange } from '../services/bulk-orders.service';

export interface ProposeExtensionModalProps {
  bulkOrderId: string;
  /** Human-readable bulk order number, e.g. "BULK-2025-011". */
  bulkNumber: string;
  /** Current valid-until date (ISO) shown in the warning banner. */
  currentValidUntil: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ProposeExtensionModal({
  bulkOrderId,
  bulkNumber,
  currentValidUntil,
  onClose,
  onSuccess,
}: ProposeExtensionModalProps) {
  const { t } = useTranslation('bulkOrders');
  const mutation = useProposeChange();

  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState('');

  const isValid = !!endDate && !mutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    mutation.mutate(
      {
        bulkOrderId,
        input: {
          endDate,
          message: message || undefined,
        },
      },
      {
        onSuccess: () => {
          notificationService.success(t('extension.proposeSuccess'));
          onSuccess?.();
          onClose();
        },
        onError: () => notificationService.error(t('extension.proposeError')),
      },
    );
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-[480px]">
      <ModalBody>
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div className="flex flex-col items-center text-center">
            <div className="w-full flex justify-end">
              <ModalCloseButton onClose={onClose} />
            </div>
            <IconBadge icon={<FileIcon className="w-6 h-6 text-foreground" />} />
            <h2 className="text-lg font-semibold text-foreground mt-4">
              {t('extension.title', { bulkNumber })}
            </h2>
          </div>

          <Alert variant="warning" icon={<InfoIcon className="w-5 h-5" />}>
            {t('extension.warning', {
              validUntil: currentValidUntil ? formatDate(currentValidUntil) : '-',
            })}
          </Alert>

          <FormField label={t('extension.newEndDate')} required>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              minDate={new Date().toISOString().slice(0, 10)}
            />
          </FormField>

          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              {t('extension.messageToVendor')}{' '}
              <span className="text-muted-foreground font-normal">{t('extension.optional')}</span>
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('extension.messagePlaceholder')}
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-3 pt-1">
            <Button type="submit" disabled={!isValid} className="w-full">
              {mutation.isPending ? t('extension.sending') : t('extension.sendToVendor')}
            </Button>
            <Button variant="outline" type="button" onClick={onClose} className="w-full">
              {t('extension.cancel')}
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
}
