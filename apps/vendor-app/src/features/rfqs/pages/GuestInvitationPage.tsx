import { type GuestRfqDetail, getGuestRfq } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Alert,
  Button,
  Modal,
  ModalBody,
  ModalIconHeader,
  Spinner,
  StatusErrorModal,
} from '@forethread/ui-components';
import FileTextIcon from '@forethread/ui-components/assets/icons/file-text.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import LetterIcon from '@forethread/ui-components/assets/icons/letter.svg?react';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { AdditionalQuoteDetails } from '../components/AdditionalQuoteDetails';
import { BulkLevelDefaults } from '../components/BulkLevelDefaults';
import { ResponseLineItemsTable } from '../components/ResponseLineItemsTable';
import { useGuestRfqResponse } from '../hooks/useGuestRfqResponse';

export default function GuestInvitationPage() {
  const { t } = useTranslation('rfqs');
  const { token } = useParams<{ token: string }>();

  const {
    data: rfq,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['guest-rfq', token],
    queryFn: () => getGuestRfq(token ?? ''),
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !rfq || !token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="max-w-md text-center p-8">
          <Alert variant="destructive">{t('guest.invalidToken')}</Alert>
          <p className="text-sm text-muted-foreground mt-4">{t('guest.invalidTokenHint')}</p>
        </div>
      </div>
    );
  }

  return <GuestResponseContent rfq={rfq} token={token} />;
}

/* ─── Main Content ─────────────────────────────────────────────────────────── */

const QUOTABLE_STATUSES = ['OPEN', 'AWAITING_RESPONSE'];

function GuestResponseContent({ rfq, token }: { rfq: GuestRfqDetail; token: string }) {
  const { t } = useTranslation('rfqs');
  const form = useGuestRfqResponse(rfq, token);
  const canRespond = QUOTABLE_STATUSES.includes(rfq.status);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);

  useEffect(() => {
    if (form.submitSuccess) setShowSuccessModal(true);
  }, [form.submitSuccess]);

  useEffect(() => {
    if (form.submitError) setShowErrorModal(true);
  }, [form.submitError]);

  const handleSubmit = useCallback(() => {
    void form.handleSubmit();
  }, [form]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* ═══ Header ═══ */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {t('guest.title', { rfqNumber: rfq.rfqNumber ?? rfq.id.slice(0, 8) })}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('guest.subtitle', {
                contractor: rfq.contractorName,
                vendor: rfq.vendorName,
              })}
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            leftIcon={<LetterIcon className="w-4 h-4" />}
            onClick={handleSubmit}
            disabled={!canRespond || form.isSubmitting}
          >
            {form.isSubmitting ? t('response.submitting') : t('response.submit')}
          </Button>
        </div>
      </header>

      {/* ═══ Info banner ═══ */}
      <div className="px-6 pt-4 max-w-[1400px] mx-auto w-full">
        <Alert variant="info" icon={<InfoIcon className="w-4 h-4" />}>
          {t('guest.infoBanner')}
        </Alert>
      </div>

      {/* ═══ RFQ Summary ═══ */}
      <div className="px-6 pt-4 max-w-[1400px] mx-auto w-full">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-bold text-foreground mb-3">{t('guest.rfqDetails')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t('guest.contractor')}</span>
              <p className="font-medium text-foreground">{rfq.contractorName}</p>
            </div>
            {rfq.projectName && (
              <div>
                <span className="text-muted-foreground">{t('guest.project')}</span>
                <p className="font-medium text-foreground">{rfq.projectName}</p>
              </div>
            )}
            {rfq.deliveryLocation && (
              <div>
                <span className="text-muted-foreground">{t('guest.deliveryLocation')}</span>
                <p className="font-medium text-foreground">{rfq.deliveryLocation}</p>
              </div>
            )}
            {rfq.needByDate && (
              <div>
                <span className="text-muted-foreground">{t('guest.needByDate')}</span>
                <p className="font-medium text-foreground">
                  {new Date(rfq.needByDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Form ═══ */}
      <div className="flex-1 px-6 py-4 max-w-[1400px] mx-auto w-full space-y-4">
        <BulkLevelDefaults
          bulkDefaults={form.bulkDefaults}
          onFieldChange={form.setBulkField}
          expanded={form.bulkExpanded}
          onToggleExpanded={form.setBulkExpanded}
          warehouses={[]}
          warehousesLoading={false}
        />

        <ResponseLineItemsTable
          lineItems={form.lineItems}
          onToggleInclude={form.toggleInclude}
          onUpdateItem={form.updateLineItem}
          onToggleExpanded={form.toggleExpanded}
          totals={form.totals}
          onOpenSubstitute={() => {}}
        />

        <AdditionalQuoteDetails
          validityPeriod={form.validityPeriod}
          onValidityPeriodChange={form.setValidityPeriod}
          additionalNotes={form.additionalNotes}
          onAdditionalNotesChange={form.setAdditionalNotes}
          attachments={[]}
          onFileUpload={() => {}}
          onRemoveAttachment={() => {}}
          uploadError={null}
          isUploading={false}
        />
      </div>

      {/* ═══ Success Modal ═══ */}
      {showSuccessModal && (
        <Modal onClose={() => setShowSuccessModal(false)}>
          <ModalBody>
            <ModalIconHeader
              icon={<FileTextIcon className="w-6 h-6 text-foreground" />}
              title={t('guest.successTitle')}
              subtitle={t('guest.successDescription')}
              onClose={() => setShowSuccessModal(false)}
            />
            <div className="mt-5">
              <p className="text-sm text-muted-foreground text-center">{t('guest.successHint')}</p>
            </div>
          </ModalBody>
        </Modal>
      )}

      {/* ═══ Error Modal ═══ */}
      {showErrorModal && (
        <StatusErrorModal
          onClose={() => setShowErrorModal(false)}
          title={t('response.errorTitle')}
          description={
            form.submitError ??
            t('response.errorDescription', { rfqId: rfq.rfqNumber ?? rfq.id.slice(0, 8) })
          }
          primaryButtonLabel={t('guest.tryAgain')}
          onPrimaryClick={() => setShowErrorModal(false)}
        />
      )}
    </div>
  );
}
