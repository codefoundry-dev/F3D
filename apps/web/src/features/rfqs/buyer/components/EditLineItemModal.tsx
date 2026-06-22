import type { RfqLineItem, UpdateLineItemPayload } from '@forethread/api-client';
import { updateLineItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Alert,
  Button,
  FormField,
  GridModal,
  Input,
  onDigitsOnly,
} from '@forethread/ui-components';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface EditLineItemModalProps {
  rfqId: string;
  lineItem: RfqLineItem;
  onClose: () => void;
}

export function EditLineItemModal({ rfqId, lineItem, onClose }: EditLineItemModalProps) {
  const { t } = useTranslation(['rfqs', 'common']);
  const queryClient = useQueryClient();

  const [materialName, setMaterialName] = useState(lineItem.materialName);
  const [quantity, setQuantity] = useState(String(lineItem.quantity));
  const [unit, setUnit] = useState(lineItem.unit);
  const [description, setDescription] = useState(lineItem.description ?? '');

  const mutation = useMutation({
    mutationFn: (payload: UpdateLineItemPayload) => updateLineItem(rfqId, lineItem.id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rfqs', rfqId] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      materialName,
      quantity: Number(quantity),
      unit,
      description: description ? description : null,
    });
  };

  return (
    <GridModal
      onClose={onClose}
      icon={<EditIcon className="size-6 text-gray-700" />}
      title={t('lineItemsTab.editModal.title')}
      description={t('lineItemsTab.editModal.subtitle')}
      onSubmit={handleSubmit}
      actions={
        <>
          <Button type="submit" isLoading={mutation.isPending} className="w-full">
            {mutation.isPending
              ? t('lineItemsTab.editModal.submitting')
              : t('lineItemsTab.editModal.submitChanges')}
          </Button>
          <Button variant="outline" type="button" onClick={onClose} className="w-full">
            {t('common:cancel')}
          </Button>
        </>
      }
    >
      <FormField label={t('lineItemsTab.materialName')} required>
        <Input type="text" value={materialName} onChange={(e) => setMaterialName(e.target.value)} />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label={t('lineItemsTab.qtyOrdered')} required>
          <Input
            inputMode="numeric"
            pattern="[0-9]*"
            onKeyDown={onDigitsOnly}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </FormField>

        <FormField label={t('lineItemsTab.uom')} required>
          <Input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </FormField>
      </div>

      <div>
        <label className="block mb-1.5">
          <span className="text-sm font-medium text-card-foreground">
            {t('lineItemsTab.description')}&nbsp;
            <span className="text-muted-foreground font-normal">({t('common:optional')})</span>
          </span>
        </label>
        <Input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {mutation.isError && (
        <Alert variant="destructive">{t('lineItemsTab.editModal.updateError')}</Alert>
      )}
    </GridModal>
  );
}
