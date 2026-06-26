import { exportRfqs } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  usePageTitleStore,
  useCreateDraftPoFromQuote,
  useRfq,
  RfqDetailTabs,
  RfqResponsesTab,
  ResponsesViewToggle,
} from '@forethread/rfq-shared';
import type { RfqTab } from '@forethread/rfq-shared';
import { Button, Spinner, toast } from '@forethread/ui-components';
import DownloadIcon from '@forethread/ui-components/assets/icons/download.svg?react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { SendRfqDialog } from '../components/create/SendRfqDialog';
import { ManageVendorsDialog } from '../components/ManageVendorsDialog';
import { RfqDetailsTab } from '../components/RfqDetailsTab';
import { RfqDocumentsTab } from '../components/RfqDocumentsTab';
import { RfqEmailLogTab } from '../components/RfqEmailLogTab';
import { RfqLineItemsTab } from '../components/RfqLineItemsTab';
import { RfqQuoteAuditTab } from '../components/RfqQuoteAuditTab';
import { useSendRfq, useUpdateRfq } from '../services/rfqs.service';

export default function RfqDetailPage() {
  const { t } = useTranslation('rfqs');
  const { id } = useParams<{ id: string }>();
  const { data: rfq, isLoading, isError } = useRfq(id ?? '');
  const setPageTitle = usePageTitleStore((s) => s.setTitle);

  useEffect(() => {
    if (rfq) setPageTitle(rfq.projectName);
    return () => setPageTitle(null);
  }, [rfq, setPageTitle]);

  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs: RfqTab[] = [
    'details',
    'lineItems',
    'responses',
    'documents',
    'emailLog',
    'audit',
  ];
  const tabParam = searchParams.get('tab') as RfqTab | null;
  const activeTab: RfqTab = tabParam && validTabs.includes(tabParam) ? tabParam : 'details';

  const setActiveTab = useCallback(
    (tab: RfqTab) => setSearchParams({ tab }, { replace: true }),
    [setSearchParams],
  );

  const [responsesViewMode, setResponsesViewMode] = useState<'list' | 'table'>('list');
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showVendorsDialog, setShowVendorsDialog] = useState(false);
  const sendRfq = useSendRfq();
  const updateRfq = useUpdateRfq();
  const navigate = useNavigate();
  const createDraftPo = useCreateDraftPoFromQuote(id ?? '');

  // On an AWARDED RFQ the winning quote is the APPROVED response. Awarding only
  // marks the RFQ awarded; the post-approve prompt that offers to spin up the
  // draft PO is transient, so expose a persistent fallback that recreates it on
  // demand (the backend keeps APPROVED quotes in the comparison, so this works
  // any time after the award).
  const awardedQuote = rfq?.quoteResponses?.find((qr) => qr.status === 'APPROVED');

  const handleCreateDraftPo = useCallback(() => {
    if (!awardedQuote) return;
    createDraftPo.mutate(awardedQuote.id, {
      onSuccess: (pos) => {
        const po = pos[0];
        toast.success(
          po
            ? t('actions.draftPoCreated', { poNumber: po.poNumber })
            : t('startOrder.poDraftCreated'),
        );
        if (po) navigate(ROUTES.purchaseOrderDetail.replace(':id', po.id));
      },
      onError: () => toast.error(t('startOrder.createError')),
    });
  }, [awardedQuote, createDraftPo, navigate, t]);

  // Close the dialog when the mutation succeeds; the RFQ cache update flips the
  // status to OPEN, which re-renders the page without the Send button.
  const handleSend = useCallback(
    async (cc: string[]) => {
      if (!rfq) return;
      try {
        await sendRfq.mutateAsync({ id: rfq.id, cc });
        setShowSendDialog(false);
      } catch {
        // error surfaces inside the dialog via sendRfq.isError
      }
    },
    [rfq, sendRfq],
  );

  // Persist the chosen vendors onto the draft RFQ. `useUpdateRfq` invalidates
  // the RFQ cache, so `rfq.vendors` repopulates and the Send button enables.
  const handleSaveVendors = useCallback(
    async ({ vendorIds, salesRepIds }: { vendorIds: string[]; salesRepIds: string[] }) => {
      if (!rfq) return;
      try {
        await updateRfq.mutateAsync({ id: rfq.id, dto: { vendorIds, salesRepIds } });
        setShowVendorsDialog(false);
      } catch {
        // error surfaces inside the dialog via updateRfq.isError
      }
    },
    [rfq, updateRfq],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !rfq) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">{t('detail.noData')}</div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-8 pt-4 md:pt-6 pb-3 md:pb-4">
        <RfqDetailTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={validTabs}
          rightSlot={
            activeTab === 'details' ? (
              <div className="flex items-center gap-2">
                {/* DRAFT RFQs (including those converted from a Material Request)
                    start with no vendors — let the user pick them before sending. */}
                {rfq.status === 'DRAFT' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVendorsDialog(true)}
                    data-testid="select-vendors"
                  >
                    {(rfq.vendors?.length ?? 0) === 0
                      ? t('actions.selectVendors')
                      : t('actions.editVendors')}
                  </Button>
                )}
                {/* Only DRAFT RFQs can be sent; once OPEN the button disappears. */}
                {rfq.status === 'DRAFT' && (
                  <Button
                    size="sm"
                    onClick={() => setShowSendDialog(true)}
                    disabled={
                      sendRfq.isPending ||
                      (rfq.lineItems?.length ?? 0) === 0 ||
                      (rfq.vendors?.length ?? 0) === 0
                    }
                    title={
                      (rfq.lineItems?.length ?? 0) === 0 || (rfq.vendors?.length ?? 0) === 0
                        ? t('detail.sendDisabledHint')
                        : undefined
                    }
                    data-testid="send-to-vendors"
                  >
                    {t('actions.sendToVendors')}
                  </Button>
                )}
                {/* Awarding an RFQ only flips it to AWARDED. The prompt that
                    offers to spin up the draft PO is transient, so give the
                    buyer a persistent fallback to create it from the winning
                    quote at any time. */}
                {rfq.status === 'AWARDED' && awardedQuote && (
                  <Button
                    size="sm"
                    onClick={handleCreateDraftPo}
                    disabled={createDraftPo.isPending}
                    data-testid="create-draft-po"
                  >
                    {createDraftPo.isPending
                      ? t('actions.creatingDraftPo')
                      : t('actions.createDraftPo')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<DownloadIcon className="w-4 h-4" />}
                  onClick={() => {
                    void exportRfqs('pdf', { search: rfq.id }).then(({ url }) =>
                      window.open(url, '_blank'),
                    );
                  }}
                >
                  {t('actions.exportAs')}
                </Button>
              </div>
            ) : activeTab === 'responses' ? (
              <ResponsesViewToggle
                viewMode={responsesViewMode}
                onViewModeChange={setResponsesViewMode}
              />
            ) : undefined
          }
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-6 md:pb-8">
        {activeTab === 'details' && <RfqDetailsTab rfq={rfq} layout="page" />}
        {activeTab === 'lineItems' && (
          <RfqLineItemsTab rfqId={rfq.id} lineItems={rfq.lineItems ?? []} layout="page" />
        )}
        {activeTab === 'responses' && (
          <RfqResponsesTab
            rfqId={rfq.id}
            quoteResponses={rfq.quoteResponses}
            viewMode={responsesViewMode}
            onViewModeChange={setResponsesViewMode}
          />
        )}
        {activeTab === 'documents' && (
          <RfqDocumentsTab rfqId={rfq.id} documents={rfq.documents ?? []} hideUpload />
        )}
        {activeTab === 'emailLog' && <RfqEmailLogTab rfqId={rfq.id} />}
        {activeTab === 'audit' && <RfqQuoteAuditTab rfqId={rfq.id} />}
      </div>

      {showSendDialog && (
        <SendRfqDialog
          vendorCount={rfq.vendors?.length ?? 0}
          isSending={sendRfq.isPending}
          isError={sendRfq.isError}
          onCancel={() => setShowSendDialog(false)}
          onSend={(cc) => void handleSend(cc)}
        />
      )}

      {showVendorsDialog && (
        <ManageVendorsDialog
          currentVendorIds={rfq.vendors?.map((v) => v.id) ?? []}
          currentSalesRepIds={rfq.vendors?.flatMap((v) => v.contacts.map((c) => c.id)) ?? []}
          isSaving={updateRfq.isPending}
          isError={updateRfq.isError}
          onCancel={() => setShowVendorsDialog(false)}
          onSave={(selection) => void handleSaveVendors(selection)}
        />
      )}
    </div>
  );
}
