import type { BulkOrderLineItemDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  Input,
  FormField,
  Button,
  Alert,
  IconBadge,
  CustomDropdown,
  DatePicker,
  onDecimalOnly,
  onDigitsOnly,
} from '@forethread/ui-components';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import { useState } from 'react';

import { useProposeChange } from '../services/bulk-orders.service';

interface LineItemChange {
  lineItemId: string;
  action: 'update' | 'add' | 'remove';
  unitPrice: string;
  quantity: string;
  itemReference: string;
  description: string;
  uom: string;
}

const emptyChange = (): LineItemChange => ({
  lineItemId: '',
  action: 'update',
  unitPrice: '',
  quantity: '',
  itemReference: '',
  description: '',
  uom: '',
});

export interface ProposeChangeModalProps {
  bulkOrderId: string;
  projectName: string;
  currentEndDate: string | null;
  lineItems: BulkOrderLineItemDetail[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function ProposeChangeModal({
  bulkOrderId,
  projectName,
  currentEndDate,
  lineItems,
  onClose,
  onSuccess,
}: ProposeChangeModalProps) {
  const { t: _t } = useTranslation(['bulkOrders', 'common']);
  const t = _t as (key: string, opts?: Record<string, unknown>) => string;
  const mutation = useProposeChange();

  const [endDate, setEndDate] = useState(currentEndDate ?? '');
  const [message, setMessage] = useState('');
  const [changes, setChanges] = useState<LineItemChange[]>([]);

  const lineItemOptions = lineItems.map((li) => ({
    value: li.lineItemId,
    label: `${li.itemReference} — ${li.description}`,
  }));

  const updateChange = (index: number, field: keyof LineItemChange, value: string) => {
    setChanges((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const addChange = () => setChanges((prev) => [...prev, emptyChange()]);

  const removeChange = (index: number) => {
    setChanges((prev) => prev.filter((_, i) => i !== index));
  };

  const hasEndDateChange = endDate && endDate !== currentEndDate;
  const hasLineItemChanges = changes.length > 0;
  const isValid = hasEndDateChange || hasLineItemChanges;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    mutation.mutate(
      {
        bulkOrderId,
        input: {
          endDate: hasEndDateChange ? endDate : undefined,
          message: message || undefined,
          lineItems: changes.map((c) => ({
            lineItemId: c.action !== 'add' ? c.lineItemId : undefined,
            action: c.action,
            unitPrice: c.unitPrice ? Number(c.unitPrice) : undefined,
            quantity: c.quantity ? Number(c.quantity) : undefined,
            uom: c.uom || undefined,
            itemReference: c.itemReference || undefined,
            description: c.description || undefined,
          })),
        },
      },
      {
        onSuccess: () => {
          onSuccess?.();
          onClose();
        },
      },
    );
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-[640px]">
      <ModalBody>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="flex flex-col items-center text-center mb-2">
            <div className="w-full flex justify-between items-start">
              <div className="flex-1" />
              <IconBadge icon={<EditIcon className="w-6 h-6 text-foreground" />} />
              <div className="flex-1 flex justify-end">
                <ModalCloseButton onClose={onClose} />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-foreground mt-4">
              {t('changeRequests.proposeModal.title')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t('changeRequests.proposeModal.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField label={t('changeRequests.proposeModal.projectName')}>
              <Input type="text" value={projectName} disabled />
            </FormField>
            <FormField label={t('changeRequests.proposeModal.endDate')}>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                minDate={new Date().toISOString().slice(0, 10)}
              />
            </FormField>
            <FormField label={t('changeRequests.proposeModal.message')}>
              <Input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('changeRequests.proposeModal.messagePlaceholder')}
              />
            </FormField>
          </div>

          {/* Line item changes */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {t('changeRequests.proposeModal.lineItems')}
            </h3>
            <div className="space-y-3">
              {changes.map((change, idx) => (
                <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => removeChange(idx)}
                    >
                      <DeleteIcon className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <FormField label={t('changeRequests.proposeModal.action')}>
                      <CustomDropdown
                        value={change.action}
                        onChange={(v) => updateChange(idx, 'action', v as string)}
                        options={[
                          { value: 'update', label: t('changeRequests.proposeModal.actionUpdate') },
                          { value: 'add', label: t('changeRequests.proposeModal.actionAdd') },
                          { value: 'remove', label: t('changeRequests.proposeModal.actionRemove') },
                        ]}
                      />
                    </FormField>

                    {change.action !== 'add' && (
                      <FormField label={t('changeRequests.proposeModal.selectLineItem')}>
                        <CustomDropdown
                          value={change.lineItemId}
                          onChange={(v) => updateChange(idx, 'lineItemId', v as string)}
                          options={lineItemOptions}
                          placeholder={t('changeRequests.proposeModal.selectLineItem')}
                        />
                      </FormField>
                    )}
                  </div>

                  {change.action === 'add' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="text"
                        placeholder={t('modals.itemReferenceLabel')}
                        value={change.itemReference}
                        onChange={(e) => updateChange(idx, 'itemReference', e.target.value)}
                      />
                      <Input
                        type="text"
                        placeholder={t('modals.descriptionLabel')}
                        value={change.description}
                        onChange={(e) => updateChange(idx, 'description', e.target.value)}
                      />
                    </div>
                  )}

                  {change.action !== 'remove' && (
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        inputMode="decimal"
                        pattern="[0-9]*\.?[0-9]*"
                        onKeyDown={onDecimalOnly}
                        placeholder={t('modals.pricePerUnitLabel')}
                        value={change.unitPrice}
                        onChange={(e) => updateChange(idx, 'unitPrice', e.target.value)}
                      />
                      <Input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        onKeyDown={onDigitsOnly}
                        placeholder={t('modals.qtyLabel')}
                        value={change.quantity}
                        onChange={(e) => updateChange(idx, 'quantity', e.target.value)}
                      />
                      {change.action === 'add' && (
                        <Input
                          type="text"
                          placeholder={t('modals.unitLabel')}
                          value={change.uom}
                          onChange={(e) => updateChange(idx, 'uom', e.target.value)}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-foreground hover:text-foreground/70 transition-colors"
              onClick={addChange}
            >
              {t('changeRequests.proposeModal.addChange')}
            </button>
          </div>

          {mutation.isError && (
            <Alert variant="destructive">{t('changeRequests.proposeError')}</Alert>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              isLoading={mutation.isPending}
              disabled={!isValid}
              className="w-full"
            >
              {mutation.isPending
                ? t('changeRequests.proposeModal.submitting')
                : t('changeRequests.proposeModal.submit')}
            </Button>
            <Button variant="outline" type="button" onClick={onClose} className="w-full">
              {t('modals.cancel')}
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
}
