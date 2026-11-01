import type { RfqLineItem } from '@forethread/api-client';
import { deleteLineItem, updateLineItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { MaterialImageThumb } from '@forethread/rfq-shared';
import {
  ConfirmDialog,
  formatDate,
  InlineEditCell,
  ScrollTable,
  toast,
} from '@forethread/ui-components';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import EditRowIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { EditLineItemModal } from './EditLineItemModal';

interface RfqLineItemsTabProps {
  rfqId?: string;
  lineItems: RfqLineItem[];
  layout?: 'panel' | 'page';
}

export function RfqLineItemsTab({ rfqId, lineItems, layout = 'panel' }: RfqLineItemsTabProps) {
  if (layout === 'panel') {
    return <LineItemsPanelLayout lineItems={lineItems} />;
  }

  return <LineItemsPageLayout rfqId={rfqId ?? ''} lineItems={lineItems} />;
}

function LineItemsPageLayout({ rfqId, lineItems }: { rfqId: string; lineItems: RfqLineItem[] }) {
  const { t } = useTranslation('rfqs');
  const queryClient = useQueryClient();

  const [editingItem, setEditingItem] = useState<RfqLineItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<RfqLineItem | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (lineItemId: string) => deleteLineItem(rfqId, lineItemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rfqs', rfqId] });
      setDeletingItem(null);
    },
  });

  // Cost code is edited in place (FOR-365); the other fields keep the modal.
  const costCodeMutation = useMutation({
    mutationFn: ({ lineItemId, costCode }: { lineItemId: string; costCode: string }) =>
      updateLineItem(rfqId, lineItemId, { costCode: costCode || null }),
    onSuccess: () => {
      toast.success(t('lineItemsTab.costCodeSaved'));
      return queryClient.invalidateQueries({ queryKey: ['rfqs', rfqId] });
    },
    onError: () => toast.error(t('lineItemsTab.costCodeSaveError')),
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-foreground">{t('lineItemsTab.title')}</h2>
      </div>

      <ScrollTable className="rounded-lg border border-border">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="bg-[color:color-mix(in_srgb,hsl(var(--foreground))_5%,hsl(var(--card)))]">
              <th className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))] border-r border-border">
                {t('lineItemsTab.materialName')}
              </th>
              <th className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))] border-r border-border">
                {t('lineItemsTab.qty')}
              </th>
              <th className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))] border-r border-border">
                {t('lineItemsTab.uom')}
              </th>
              <th className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))] border-r border-border">
                {t('lineItemsTab.costCode')}
              </th>
              <th className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))] border-r border-border">
                {t('lineItemsTab.upc')}
              </th>
              <th className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))] border-r border-border">
                {t('lineItemsTab.mpn')}
              </th>
              <th className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))] border-r border-border">
                {t('lineItemsTab.taxCode')}
              </th>
              <th className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))] border-r border-border">
                {t('lineItemsTab.expDeliveryDate')}
              </th>
              <th className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))] border-r border-border">
                {t('lineItemsTab.deliveryTime')}
              </th>
              <th className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))] border-r border-border">
                {t('lineItemsTab.deliveryLocation')}
              </th>
              <th className="p-3 text-center text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))]">
                {t('lineItemsTab.actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="p-3 text-foreground border border-border">
                  <span className="flex items-center gap-2">
                    <MaterialImageThumb url={item.imageUrl} name={item.materialName} />
                    {item.materialName}
                  </span>
                </td>
                <td className="p-3 text-foreground border border-border">{item.quantity}</td>
                <td className="p-3 text-foreground border border-border">{item.unit}</td>
                <td className="px-3 py-2 text-foreground border border-border">
                  <InlineEditCell
                    value={item.costCode}
                    label={t('lineItemsTab.costCode')}
                    emptyDisplay="-"
                    maxLength={100}
                    onSave={(costCode) =>
                      costCodeMutation.mutateAsync({ lineItemId: item.id, costCode })
                    }
                    data-testid={`rfq-line-cost-code-${item.id}`}
                  />
                </td>
                <td className="p-3 text-foreground border border-border">{item.upc ?? '-'}</td>
                <td className="p-3 text-foreground border border-border">
                  {item.manufacturerPartNumber ?? '-'}
                </td>
                <td className="p-3 text-foreground border border-border">{item.taxCode ?? '-'}</td>
                <td className="p-3 text-foreground border border-border">
                  {formatDate(item.expectedDeliveryDate)}
                </td>
                <td className="p-3 text-foreground border border-border whitespace-nowrap">
                  {item.deliveryTime ?? '-'}
                </td>
                <td className="p-3 text-foreground border border-border truncate max-w-[160px]">
                  {item.deliveryLocation ?? '-'}
                </td>
                <td className="p-3 border border-border">
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title={t('actions.edit')}
                      onClick={() => setEditingItem(item)}
                    >
                      <EditRowIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title={t('actions.delete')}
                      onClick={() => setDeletingItem(item)}
                    >
                      <DeleteIcon className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-[color:color-mix(in_srgb,hsl(var(--muted))_50%,hsl(var(--card)))]">
              <td colSpan={11} className="px-6 py-3">
                <span className="text-sm text-muted-foreground">
                  {t('lineItemsTab.totalItems')}:{' '}
                  <span className="text-foreground">{lineItems.length}</span>
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </ScrollTable>

      {editingItem && (
        <EditLineItemModal
          rfqId={rfqId}
          lineItem={editingItem}
          onClose={() => setEditingItem(null)}
        />
      )}

      {deletingItem && (
        <ConfirmDialog
          title={t('lineItemsTab.deleteConfirm.title')}
          message={t('lineItemsTab.deleteConfirm.message')}
          confirmLabel={t('lineItemsTab.deleteConfirm.confirm')}
          cancelLabel={t('lineItemsTab.deleteConfirm.cancel')}
          confirmVariant="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          onConfirm={() => deleteMutation.mutate(deletingItem.id)}
          onCancel={() => setDeletingItem(null)}
        />
      )}
    </div>
  );
}

function LineItemsPanelLayout({ lineItems }: { lineItems: RfqLineItem[] }) {
  const { t } = useTranslation('rfqs');
  return (
    <div>
      <ScrollTable>
        <table className="w-full min-w-[500px] text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left">
              <th className="pb-2 pr-3 font-medium text-muted-foreground text-xs">
                {t('lineItemsTab.materialName')}
              </th>
              <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
                {t('lineItemsTab.qty')}
              </th>
              <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
                {t('lineItemsTab.uom')}
              </th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item) => (
              <tr key={item.id} className="border-b border-foreground/10">
                <td className="py-2.5 pr-3 text-foreground">
                  <span className="flex items-center gap-2">
                    <MaterialImageThumb url={item.imageUrl} name={item.materialName} />
                    {item.materialName}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-foreground">{item.quantity}</td>
                <td className="py-2.5 px-3 text-muted-foreground">{item.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>

      <div className="flex justify-end mt-3 pt-3 border-t border-foreground/10">
        <span className="text-sm text-muted-foreground">
          {t('lineItemsTab.totalItems')}:{' '}
          <span className="font-medium text-foreground">{lineItems.length}</span>
        </span>
      </div>
    </div>
  );
}
