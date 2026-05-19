import type { FilterDropdownOption } from '@forethread/ui-components';
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
  onDigitsOnly,
  onDecimalOnly,
} from '@forethread/ui-components';
import PlusIcon from '@forethread/ui-components/assets/icons/plus-in-circle.svg?react';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import { useState } from 'react';

import { useCreateBulkOrder } from '../services/bulk-orders.service';

interface LineItemDraft {
  itemReference: string;
  description: string;
  qty: string;
  unit: string;
  pricePerUnit: string;
}

const emptyLineItem = (): LineItemDraft => ({
  itemReference: '',
  description: '',
  qty: '',
  unit: '',
  pricePerUnit: '',
});

export interface CreateBulkOrderModalProps {
  projectOptions: FilterDropdownOption[];
  vendorOptions: FilterDropdownOption[];
  onClose: () => void;
  onSuccess?: (bulkOrderId: string) => void;
}

export function CreateBulkOrderModal({
  projectOptions,
  vendorOptions,
  onClose,
  onSuccess,
}: CreateBulkOrderModalProps) {
  const { t } = useTranslation(['bulkOrders', 'common']);
  const mutation = useCreateBulkOrder();

  const [projectId, setProjectId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [brands, setBrands] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([emptyLineItem()]);

  const updateLineItem = (index: number, field: keyof LineItemDraft, value: string) => {
    setLineItems((prev) => prev.map((li, i) => (i === index ? { ...li, [field]: value } : li)));
  };

  const addLineItem = () => setLineItems((prev) => [...prev, emptyLineItem()]);

  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const isValid =
    projectId &&
    vendorId &&
    lineItems.length > 0 &&
    lineItems.every(
      (li) =>
        li.itemReference &&
        li.description &&
        Number(li.qty) > 0 &&
        li.unit &&
        Number(li.pricePerUnit) >= 0,
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    mutation.mutate(
      {
        projectId,
        vendorId,
        brands: brands ? brands : undefined,
        endDate: endDate ? endDate : undefined,
        lineItems: lineItems.map((li) => ({
          itemReference: li.itemReference,
          description: li.description,
          qty: Number(li.qty),
          unit: li.unit,
          pricePerUnit: Number(li.pricePerUnit),
        })),
      },
      {
        onSuccess: (data) => {
          onSuccess?.(data.bulkId);
          onClose();
        },
      },
    );
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-[560px]">
      <ModalBody>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="flex flex-col items-center text-center mb-2">
            <div className="w-full flex justify-between items-start">
              <div className="flex-1" />
              <IconBadge icon={<PlusIcon className="w-6 h-6 text-foreground" />} />
              <div className="flex-1 flex justify-end">
                <ModalCloseButton onClose={onClose} />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-foreground mt-4">
              {t('modals.createTitle')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{t('modals.createSubtitle')}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('modals.projectLabel')} required>
              <CustomDropdown
                value={projectId}
                onChange={(v) => setProjectId(v as string)}
                options={projectOptions.map((o) => ({ value: o.value, label: o.label }))}
                placeholder={t('modals.selectProject')}
              />
            </FormField>
            <FormField label={t('modals.vendorLabel')} required>
              <CustomDropdown
                value={vendorId}
                onChange={(v) => setVendorId(v as string)}
                options={vendorOptions.map((o) => ({ value: o.value, label: o.label }))}
                placeholder={t('modals.selectVendor')}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('modals.brandsLabel')}>
              <Input type="text" value={brands} onChange={(e) => setBrands(e.target.value)} />
            </FormField>
            <FormField label={t('modals.endDateLabel')}>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                minDate={new Date().toISOString().slice(0, 10)}
              />
            </FormField>
          </div>

          {/* Line Items */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {t('modals.lineItemsSection')}
            </h3>
            <div className="space-y-3">
              {lineItems.map((li, idx) => (
                <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => removeLineItem(idx)}
                      >
                        <DeleteIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="text"
                      placeholder={t('modals.itemReferenceLabel')}
                      value={li.itemReference}
                      onChange={(e) => updateLineItem(idx, 'itemReference', e.target.value)}
                    />
                    <Input
                      type="text"
                      placeholder={t('modals.descriptionLabel')}
                      value={li.description}
                      onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      onKeyDown={onDigitsOnly}
                      placeholder={t('modals.qtyLabel')}
                      value={li.qty}
                      onChange={(e) => updateLineItem(idx, 'qty', e.target.value)}
                    />
                    <Input
                      type="text"
                      placeholder={t('modals.unitLabel')}
                      value={li.unit}
                      onChange={(e) => updateLineItem(idx, 'unit', e.target.value)}
                    />
                    <Input
                      inputMode="decimal"
                      pattern="[0-9]*\.?[0-9]*"
                      onKeyDown={onDecimalOnly}
                      placeholder={t('modals.pricePerUnitLabel')}
                      value={li.pricePerUnit}
                      onChange={(e) => updateLineItem(idx, 'pricePerUnit', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-foreground hover:text-foreground/70 transition-colors"
              onClick={addLineItem}
            >
              {t('modals.addLineItem')}
            </button>
          </div>

          {mutation.isError && <Alert variant="destructive">{t('modals.createError')}</Alert>}

          <div className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              isLoading={mutation.isPending}
              disabled={!isValid}
              className="w-full"
            >
              {mutation.isPending ? t('modals.submitting') : t('modals.submit')}
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
