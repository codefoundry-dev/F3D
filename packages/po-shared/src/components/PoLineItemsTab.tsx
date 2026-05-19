import type { PoLineItemDetail } from '@forethread/api-client';
import { updatePurchaseOrder } from '@forethread/api-client';
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
  onDigitsOnly,
} from '@forethread/ui-components';
import EditInSquareIcon from '@forethread/ui-components/assets/icons/edit-in-square.svg?react';
import EditWithoutLineIcon from '@forethread/ui-components/assets/icons/edit-without-line.svg?react';
import ArrowRightIcon from '@forethread/ui-components/assets/icons/arrow-right.svg?react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { formatCurrency } from '@forethread/ui-components';

interface PoLineItemsTabProps {
  poId?: string;
  lineItems: PoLineItemDetail[];
  layout?: 'panel' | 'page';
  onEditAll?: () => void;
  /** When true, hides per-row edit buttons and the Actions column (vendor view) */
  readOnly?: boolean;
}

const TH = 'px-3 py-2.5 text-xs font-bold tracking-wide border-b border-r border-border text-left';
const TH_LAST = 'px-3 py-2.5 text-xs font-bold tracking-wide border-b border-border text-left';

export function PoLineItemsTab({
  poId,
  lineItems,
  layout = 'panel',
  onEditAll,
  readOnly,
}: PoLineItemsTabProps) {
  const { t } = useTranslation('purchaseOrders');

  const [editingItem, setEditingItem] = useState<PoLineItemDetail | null>(null);

  const totalItems = lineItems.length;
  const totalQty = lineItems.reduce((sum, li) => sum + li.quantityOrdered, 0);
  const totalSum = lineItems.reduce((sum, li) => sum + li.lineTotal, 0);

  if (lineItems.length === 0) {
    return (
      <div>
        {layout === 'page' && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium text-foreground">{t('lineItemsTab.title')}</h2>
          </div>
        )}
        <p className="py-8 text-center text-muted-foreground">{t('lineItemsTab.noItems')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-base font-bold text-foreground">{t('lineItemsTab.title')}</h2>
        {layout === 'page' && onEditAll && (
          <button
            type="button"
            className="flex items-center gap-1.5 text-foreground font-medium text-lg hover:opacity-80 transition-opacity"
            onClick={onEditAll}
          >
            <EditWithoutLineIcon className="w-6 h-6" />
            <span>{t('actions.edit' as never)}</span>
            <ArrowRightIcon className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[800px] text-sm"
          style={{ borderCollapse: 'separate', borderSpacing: 0 }}
        >
          <thead>
            <tr className="bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))]">
              <th className={TH}>{t('lineItemsTab.materialName')}</th>
              <th className={TH}>{t('lineItemsTab.description')}</th>
              <th className={TH}>{t('lineItemsTab.qtyOrdered')} *</th>
              <th className={TH}>{t('lineItemsTab.uom')} *</th>
              <th className={TH}>{t('lineItemsTab.unitPrice')}</th>
              <th className={TH}>{t('lineItemsTab.lineTotal')}</th>
              {layout === 'page' && poId && !readOnly && (
                <th className={`${TH_LAST} w-[60px] text-center`}>
                  {t('lineItemsTab.actions', { defaultValue: 'Actions' })}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => {
              const isLast = index === lineItems.length - 1;
              const cellBorder = `border-r border-border ${isLast ? '' : 'border-b'}`;
              return (
                <tr key={item.id}>
                  <td className={`px-3 py-2.5 text-foreground ${cellBorder}`}>
                    {item.materialName}
                  </td>
                  <td className={`px-3 py-2.5 text-foreground ${cellBorder}`}>
                    {item.description ?? '-'}
                  </td>
                  <td className={`px-3 py-2.5 text-foreground ${cellBorder}`}>
                    {item.quantityOrdered}
                  </td>
                  <td className={`px-3 py-2.5 text-foreground ${cellBorder}`}>
                    {item.unitOfMeasure}
                  </td>
                  <td className={`px-3 py-2.5 text-foreground ${cellBorder}`}>
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className={`px-3 py-2.5 text-foreground ${cellBorder}`}>
                    {formatCurrency(item.lineTotal)}
                  </td>
                  {layout === 'page' && poId && !readOnly && (
                    <td className={`px-3 py-2.5 ${isLast ? '' : 'border-b'} border-border`}>
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title={t('actions.edit' as never)}
                          onClick={() => setEditingItem(item)}
                        >
                          <EditInSquareIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          {/* Footer totals */}
          <tfoot>
            <tr className="border-t border-border bg-muted/50">
              <td colSpan={layout === 'page' && poId && !readOnly ? 7 : 6} className="px-6 py-3">
                <div className="flex items-center gap-8 text-sm">
                  <span className="text-muted-foreground">
                    {t('lineItemsTab.totalItems')}:{' '}
                    <span className="text-foreground font-medium">{totalItems}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {t('lineItemsTab.totalQty', { defaultValue: 'Total Qty' })}:{' '}
                    <span className="text-foreground font-medium">{totalQty}</span>
                  </span>
                  <span className="ml-auto text-muted-foreground">
                    {t('lineItemsTab.totalSum', { defaultValue: 'Total sum' })}:{' '}
                    <span className="text-foreground font-medium">{formatCurrency(totalSum)}</span>
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Edit Modal */}
      {editingItem && poId && !readOnly && (
        <EditPoLineItemModal
          poId={poId}
          lineItem={editingItem}
          allLineItems={lineItems}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}

/* ─── Edit Modal ──────────────────────────────────────────────────────────── */

interface EditPoLineItemModalProps {
  poId: string;
  lineItem: PoLineItemDetail;
  allLineItems: PoLineItemDetail[];
  onClose: () => void;
}

function EditPoLineItemModal({ poId, lineItem, allLineItems, onClose }: EditPoLineItemModalProps) {
  const { t } = useTranslation(['purchaseOrders', 'common']);
  const queryClient = useQueryClient();

  const [materialName, setMaterialName] = useState(lineItem.materialName ?? '');
  const [description, setDescription] = useState(lineItem.description ?? '');
  const [quantityOrdered, setQuantityOrdered] = useState(String(lineItem.quantityOrdered));
  const [unitOfMeasure, setUnitOfMeasure] = useState(lineItem.unitOfMeasure);
  const [unitPrice, setUnitPrice] = useState(String(lineItem.unitPrice));

  const mutation = useMutation({
    mutationFn: async () => {
      const updatedLineItems = allLineItems.map((li) => {
        const base = {
          materialId: li.materialId ?? undefined,
          materialCode: li.materialCode ?? undefined,
          description: li.description ?? undefined,
          quantityOrdered: li.quantityOrdered,
          unitOfMeasure: li.unitOfMeasure,
          unitPrice: li.unitPrice,
          costCode: li.costCode ?? undefined,
          notes: li.notes ?? undefined,
          expectedDeliveryDate: li.expectedDeliveryDate ?? undefined,
          deliveryLocationId: li.deliveryLocation ?? undefined,
        };
        if (li.id === lineItem.id) {
          return {
            ...base,
            description: description ? description : undefined,
            quantityOrdered: Number(quantityOrdered),
            unitOfMeasure,
            unitPrice: Number(unitPrice),
          };
        }
        return base;
      });
      await updatePurchaseOrder(poId, { lineItems: updatedLineItems });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders', poId] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-[560px]">
      <ModalBody>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-2">
            <div className="w-full flex justify-between items-start">
              <div className="flex-1" />
              <IconBadge icon={<EditWithoutLineIcon className="w-6 h-6 text-foreground" />} />
              <div className="flex-1 flex justify-end">
                <ModalCloseButton onClose={onClose} />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-foreground mt-4">
              {t('lineItemsTab.editModal.title', { defaultValue: 'Edit Line Item' })}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t('lineItemsTab.editModal.subtitle', {
                defaultValue: 'Update the line item details below',
              })}
            </p>
          </div>

          {/* Material Name */}
          <FormField label={t('lineItemsTab.materialName')} required>
            <Input
              type="text"
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
              disabled
            />
          </FormField>

          {/* Quantity + UoM */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('lineItemsTab.qtyOrdered')} required>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                onKeyDown={onDigitsOnly}
                value={quantityOrdered}
                onChange={(e) => setQuantityOrdered(e.target.value)}
              />
            </FormField>

            <FormField label={t('lineItemsTab.uom')} required>
              <Input
                type="text"
                value={unitOfMeasure}
                onChange={(e) => setUnitOfMeasure(e.target.value)}
              />
            </FormField>
          </div>

          {/* Unit Price */}
          <FormField label={t('lineItemsTab.unitPrice')} required>
            <Input
              inputMode="decimal"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
          </FormField>

          {/* Description */}
          <div>
            <label className="block mb-1.5">
              <span className="text-sm font-medium text-card-foreground">
                {t('lineItemsTab.description')}&nbsp;
                <span className="text-muted-foreground font-normal">({t('common:optional')})</span>
              </span>
            </label>
            <Input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Error */}
          {mutation.isError && (
            <Alert variant="destructive">
              {t('lineItemsTab.editModal.updateError', {
                defaultValue: 'Failed to update line item',
              })}
            </Alert>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2">
            <Button type="submit" isLoading={mutation.isPending} className="w-full">
              {mutation.isPending
                ? t('lineItemsTab.editModal.submitting', { defaultValue: 'Saving...' })
                : t('lineItemsTab.editModal.submitChanges', { defaultValue: 'Save Changes' })}
            </Button>
            <Button variant="outline" type="button" onClick={onClose} className="w-full">
              {t('common:cancel')}
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
}
