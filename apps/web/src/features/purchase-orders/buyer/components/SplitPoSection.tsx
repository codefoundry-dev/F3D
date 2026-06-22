import { issuePurchaseOrder, type PoDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Badge, Button, formatCurrency, notificationService } from '@forethread/ui-components';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

interface SplitPoSectionProps {
  po: PoDetail;
}

const childHref = (id: string) => ROUTES.purchaseOrderDetail.replace(':id', id);

/**
 * Internal-only surfacing of the split parent/child relationship (US 5.19):
 *  - on a SPLIT parent, list the per-vendor child POs and offer "Issue all";
 *  - on a split child, link back to the consolidated parent.
 * Rendered only on the contractor (buyer) detail page — vendors never see the
 * parent, so this is intentionally absent from the shared PoDetailsTab.
 */
export function SplitPoSection({ po }: SplitPoSectionProps) {
  const { t } = useTranslation('purchaseOrders');
  const queryClient = useQueryClient();

  const issueAll = useMutation({
    mutationFn: async () => {
      const draftChildren = po.childPos.filter((c) => c.status === 'DRAFT');
      for (const child of draftChildren) {
        await issuePurchaseOrder(child.id);
      }
    },
    onSuccess: () => {
      notificationService.success(t('split.issuedAll'));
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: () => notificationService.error(t('split.issueError')),
  });

  // Split child → link back to the consolidated parent.
  if (po.poType !== 'SPLIT' && po.parentPoId) {
    return (
      <div className="mb-4 rounded-xl border border-border bg-[#F4F4F6] px-4 py-3">
        <p className="text-sm font-medium text-foreground">{t('split.partOfTitle')}</p>
        <Link
          to={childHref(po.parentPoId)}
          className="text-sm text-[#175CD3] underline-offset-4 hover:underline"
        >
          {t('split.partOfLink', { poNumber: po.parentPoNumber ?? po.parentPoId })}
        </Link>
      </div>
    );
  }

  // SPLIT parent → per-vendor children list.
  if (po.poType === 'SPLIT') {
    const hasDraftChildren = po.childPos.some((c) => c.status === 'DRAFT');
    return (
      <div className="mb-4 rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{t('split.childrenTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('split.childrenSubtitle')}</p>
          </div>
          {hasDraftChildren && (
            <Button size="sm" isLoading={issueAll.isPending} onClick={() => issueAll.mutate()}>
              {t('split.issueAll')}
            </Button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">{t('split.poColumn')}</th>
              <th className="px-4 py-2 font-medium">{t('split.vendorColumn')}</th>
              <th className="px-4 py-2 font-medium">{t('split.statusColumn')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('split.totalColumn')}</th>
            </tr>
          </thead>
          <tbody>
            {po.childPos.map((child) => (
              <tr key={child.id} className="border-t border-border">
                <td className="px-4 py-2.5">
                  <Link
                    to={childHref(child.id)}
                    className="text-[#175CD3] underline-offset-4 hover:underline"
                  >
                    {child.poNumber}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-foreground">{child.vendor?.name ?? '-'}</td>
                <td className="px-4 py-2.5">
                  <Badge className="rounded-full border-0 bg-[#E8EAED] px-2 py-0.5 text-xs text-[#2D3139]">
                    {child.status}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-right text-foreground">
                  {child.totalAmount !== null
                    ? formatCurrency(child.totalAmount, po.currency)
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}
