import type { RfqLineItem } from '@forethread/api-client';
import { deleteLineItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { ConfirmDialog, formatDate } from '@forethread/ui-components';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit-without-line.svg?react';
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

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-foreground">{t('lineItemsTab.title')}</h2>
        <button
          type="button"
          className="flex items-center gap-1.5 py-1 text-foreground hover:text-foreground/70 transition-colors"
          onClick={() => {
            if (lineItems.length > 0) setEditingItem(lineItems[0]);
          }}
        >
          <EditIcon className="w-6 h-6" />
          <span className="text-lg font-medium">{t('lineItemsTab.edit')}</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="bg-foreground/5">
              <th className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))] border-r border-border">
                {t('lineItemsTab.project')}
              </th>
              <th className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))] border-r border-border">
                {t('lineItemsTab.lineItemId')}
              </th>
              <th className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))] border-r border-border">
                {t('lineItemsTab.materialName')}
              </th>
              <th className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))] border-r border-border">
                {t('lineItemsTab.description')}
              </th>
              <th className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))] border-r border-border">
                {t('lineItemsTab.qtyOrdered')}
              </th>
              <th className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))] border-r border-border">
                {t('lineItemsTab.uom')}
              </th>
              <th className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))] border-r border-border">
                {t('lineItemsTab.expDeliveryDate')}
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
                <td className="p-3 text-foreground border border-border truncate max-w-[120px]">
                  {item.projectName}
                </td>
                <td className="p-3 text-foreground border border-border">{item.id}</td>
                <td className="p-3 text-foreground border border-border">{item.materialName}</td>
                <td className="p-3 text-foreground border border-border truncate max-w-[200px]">
                  {item.description ?? '-'}
                </td>
                <td className="p-3 text-foreground border border-border">{item.quantity}</td>
                <td className="p-3 text-foreground border border-border">{item.unit}</td>
                <td className="p-3 text-foreground border border-border">
                  {formatDate(item.expectedDeliveryDate)}
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
            <tr className="border-t border-border bg-muted/50">
              <td colSpan={9} className="px-6 py-3">
                <span className="text-sm text-muted-foreground">
                  {t('lineItemsTab.totalItems')}:{' '}
                  <span className="text-foreground">{lineItems.length}</span>
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left">
              <th className="pb-2 pr-3 font-medium text-muted-foreground text-xs">
                {t('lineItemsTab.project')}
              </th>
              <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
                {t('lineItemsTab.lineItemId')}
              </th>
              <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
                {t('lineItemsTab.materialName')}
              </th>
              <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
                {t('lineItemsTab.qtyOrdered')}
              </th>
              <th className="pb-2 px-3 font-medium text-muted-foreground text-xs">
                {t('lineItemsTab.uom')}
              </th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item) => (
              <tr key={item.id} className="border-b border-foreground/10">
                <td className="py-2.5 pr-3 text-foreground">{item.projectName}</td>
                <td className="py-2.5 px-3 text-foreground">{item.id}</td>
                <td className="py-2.5 px-3 text-foreground">{item.materialName}</td>
                <td className="py-2.5 px-3 text-foreground">{item.quantity}</td>
                <td className="py-2.5 px-3 text-muted-foreground">{item.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mt-3 pt-3 border-t border-foreground/10">
        <span className="text-sm text-muted-foreground">
          {t('lineItemsTab.totalItems')}:{' '}
          <span className="font-medium text-foreground">{lineItems.length}</span>
        </span>
      </div>
    </div>
  );
}
