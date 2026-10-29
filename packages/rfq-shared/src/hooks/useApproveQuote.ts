import { useTranslation } from '@forethread/i18n';
import { toast } from '@forethread/ui-components';
import { useNavigate } from 'react-router-dom';

import { PO_DETAIL_ROUTE } from '../constants/routes';

import { useAwardQuote } from './useRfqs';

/**
 * The buyer's "Approve" on a quote (FOR-396). It awards the quote: the backend
 * approves it, marks the RFQ awarded and creates the draft PO(s) priced at the
 * quoted rates. The buyer then lands on the draft, with no "start PO?" prompt
 * in between. A multi-project RFQ yields one draft per project, and the buyer
 * lands on the first. Errors surface through the global API error toast.
 * Pass `rfqId` per call when one list spans several RFQs (the dashboard).
 */
export function useApproveQuote(defaultRfqId?: string) {
  const { t } = useTranslation('rfqs');
  const navigate = useNavigate();
  const award = useAwardQuote();

  const approve = (quoteId: string, rfqId = defaultRfqId) => {
    if (!rfqId) return;
    award.mutate(
      { rfqId, quoteId },
      {
        onSuccess: (result) => {
          const pos = result.purchaseOrders ?? [
            { id: result.purchaseOrderId, poNumber: result.poNumber },
          ];
          toast.success(
            pos.length > 1
              ? t('actions.draftPosCreated', {
                  count: pos.length,
                  poNumbers: pos.map((po) => po.poNumber).join(', '),
                })
              : t('actions.draftPoCreated', { poNumber: result.poNumber }),
          );
          navigate(PO_DETAIL_ROUTE.replace(':id', result.purchaseOrderId));
        },
      },
    );
  };

  return {
    approve,
    isPending: award.isPending,
    /** Quote currently being approved, for per-row pending state. */
    pendingQuoteId: award.isPending ? award.variables?.quoteId : undefined,
  };
}
