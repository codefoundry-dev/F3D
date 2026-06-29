import type { PoLineItemDetail } from '@forethread/api-client';
import { updatePurchaseOrder } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  GridModal,
  Input,
  FormField,
  Button,
  Alert,
  onDigitsOnly,
} from '@forethread/ui-components';
import EditInSquareIcon from '@forethread/ui-components/assets/icons/edit-in-square.svg?react';
import EditWithoutLineIcon from '@forethread/ui-components/assets/icons/edit-without-line.svg?react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { formatCurrency, formatDate } from '@forethread/ui-components';

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

  const isPageLayout = layout === 'page';
  const showActions = isPageLayout && Boolean(poId) && !readOnly;
  const columnCount = (isPageLayout ? 12 : 6) + (showActions ? 1 : 0);

  return (
    <div className="rounded-lg border border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-base font-bold text-foreground">{t('lineItemsTab.title')}</h2>
        {isPageLayout && onEditAll && (
          <button
            type="button"
            className="flex items-center gap-1.5 text-foreground font-medium text-sm hover:opacity-80 transition-opacity"
            onClick={onEditAll}
          >
            <EditWithoutLineIcon className="w-4 h-4" />
            <span>{t('actions.edit' as never)}</span>
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
              {isPageLayout && <th className={TH}>{t('lineItemsTab.materialCode')}</th>}
              {isPageLayout && <th className={TH}>{t('lineItemsTab.costCode')}</th>}
              {isPageLayout && <th className={TH}>{t('lineItemsTab.upc')}</th>}
              {isPageLayout && <th className={TH}>{t('lineItemsTab.mpn')}</th>}
              {isPageLayout && <th className={TH}>{t('lineItemsTab.taxCode')}</th>}
              <th className={TH}>{t('lineItemsTab.description')}</th>
              <th className={TH}>{t('lineItemsTab.qtyOrdered')}</th>
              <th className={TH}>{t('lineItemsTab.uom')}</th>
              {isPageLayout && <th className={TH}>{t('lineItemsTab.expDeliveryDate')}</th>}
              <th className={TH}>{t('lineItemsTab.pricePerUnit')}</th>
              <th className={TH}>{t('lineItemsTab.lineTotal')}</th>
              {showActions && (
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
                  {isPageLayout && (
                    <td className={`px-3 py-2.5 text-foreground ${cellBorder}`}>
                      {item.materialCode ?? '-'}
                    </td>
                  )}
                  {isPageLayout && (
                    <td className={`px-3 py-2.5 text-foreground ${cellBorder}`}>
                      {item.costCode ?? '-'}
                    </td>
                  )}
                  {isPageLayout && (
                    <td className={`px-3 py-2.5 text-foreground ${cellBorder}`}>
                      {item.upc ?? '-'}
                    </td>
                  )}
                  {isPageLayout && (
                    <td className={`px-3 py-2.5 text-foreground ${cellBorder}`}>
                      {item.manufacturerPartNumber ?? '-'}
                    </td>
                  )}
                  {isPageLayout && (
                    <td className={`px-3 py-2.5 text-foreground ${cellBorder}`}>
                      {item.taxCode ?? '-'}
                    </td>
                  )}
                  <td className={`px-3 py-2.5 text-foreground ${cellBorder}`}>
                    {item.description ?? '-'}
                  </td>
                  <td className={`px-3 py-2.5 text-foreground ${cellBorder}`}>
                    {item.quantityOrdered}
                  </td>
                  <td className={`px-3 py-2.5 text-foreground ${cellBorder}`}>
                    {item.unitOfMeasure}
                  </td>
                  {isPageLayout && (
                    <td className={`px-3 py-2.5 text-foreground ${cellBorder}`}>
                      {item.expectedDeliveryDate ? formatDate(item.expectedDeliveryDate) : '-'}
                    </td>
                  )}
                  <td className={`px-3 py-2.5 text-foreground ${cellBorder}`}>
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className={`px-3 py-2.5 text-foreground ${cellBorder}`}>
                    {formatCurrency(item.lineTotal)}
                  </td>
                  {showActions && (
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
              <td colSpan={columnCount} className="px-6 py-3">
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
          upc: li.upc ?? undefined,
          manufacturerPartNumber: li.manufacturerPartNumber ?? undefined,
          taxCode: li.taxCode ?? undefined,
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
    <GridModal
      onClose={onClose}
      onSubmit={handleSubmit}
      icon={<EditWithoutLineIcon className="size-6 text-gray-700" />}
      title={t('lineItemsTab.editModal.title', { defaultValue: 'Edit Line Item' })}
      description={t('lineItemsTab.editModal.subtitle', {
        defaultValue: 'Update the line item details below',
      })}
      actions={
        <>
          <Button type="submit" isLoading={mutation.isPending} className="w-full">
            {mutation.isPending
              ? t('lineItemsTab.editModal.submitting', { defaultValue: 'Saving...' })
              : t('lineItemsTab.editModal.submitChanges', { defaultValue: 'Save Changes' })}
          </Button>
          <Button variant="outline" type="button" onClick={onClose} className="w-full">
            {t('common:cancel')}
          </Button>
        </>
      }
    >
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
        <Input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {/* Error */}
      {mutation.isError && (
        <Alert variant="destructive">
          {t('lineItemsTab.editModal.updateError', {
            defaultValue: 'Failed to update line item',
          })}
        </Alert>
      )}
    </GridModal>
  );
}
