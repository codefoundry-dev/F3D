import { type GuestRfqDetail, getGuestRfq, isApiError } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Alert,
  Button,
  GridModal,
  SegmentedControl,
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
import { QuoteUploadPanel } from '../components/QuoteUploadPanel';
import { ResponseLineItemsTable } from '../components/ResponseLineItemsTable';
import { useGuestRfqResponse } from '../hooks/useGuestRfqResponse';

export default function GuestInvitationPage() {
  const { t } = useTranslation('rfqs');
  const { token } = useParams<{ token: string }>();

  const {
    data: rfq,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['guest-rfq', token],
    queryFn: () => getGuestRfq(token ?? ''),
    enabled: !!token,
    // Don't retry — a rejected token is terminal, and each attempt is rate-limited.
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !rfq || !token) {
    // A 403 means the token has been used (quote already submitted), expired or
    // revoked — distinct from a malformed/unknown link.
    const usedOrExpired = isApiError(error, 403);
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="max-w-md text-center p-8">
          <Alert variant="destructive">
            {usedOrExpired ? t('guest.usedToken') : t('guest.invalidToken')}
          </Alert>
          <p className="text-sm text-muted-foreground mt-4">
            {usedOrExpired ? t('guest.usedTokenHint') : t('guest.invalidTokenHint')}
          </p>
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

  // In upload mode the form only appears once the PDF has been read.
  const showForm = form.mode === 'manual' || form.extractionPhase === 'completed';
  const submitDisabled = !canRespond || form.isSubmitting || !showForm;

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
            disabled={submitDisabled}
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

      {/* ═══ Attachments ═══ */}
      {rfq.attachments.length > 0 && (
        <div className="px-6 pt-4 max-w-[1400px] mx-auto w-full">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-base font-bold text-foreground mb-3">{t('guest.attachments')}</h2>
            <ul className="space-y-2">
              {rfq.attachments.map((file) => (
                <li key={file.id}>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <FileTextIcon className="w-4 h-4" />
                    <span className="font-medium">{file.filename}</span>
                    <span className="text-muted-foreground">({t('guest.download')})</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ═══ Validation errors ═══ */}
      {form.validationErrors.length > 0 && (
        <div className="px-6 pt-4 max-w-[1400px] mx-auto w-full">
          <Alert variant="destructive">
            <p className="font-medium mb-1">{t('guest.validationTitle')}</p>
            <ul className="list-disc pl-5 space-y-1">
              {form.validationErrors.map((err, i) => (
                <li key={i}>
                  {err.type === 'NO_ITEMS'
                    ? t('guest.validationNoItems')
                    : t('guest.validationLineItem', { material: err.material })}
                </li>
              ))}
            </ul>
          </Alert>
        </div>
      )}

      {/* ═══ Form ═══ */}
      <div className="flex-1 px-6 py-4 max-w-[1400px] mx-auto w-full space-y-4">
        {/* Mode toggle: enter manually vs upload a quote PDF (FOR-206) */}
        {canRespond && (
          <SegmentedControl
            aria-label={t('guest.modeToggleLabel')}
            value={form.mode}
            onValueChange={form.setMode}
            items={[
              { value: 'manual', label: t('guest.modeManual') },
              { value: 'upload', label: t('guest.modeUpload') },
            ]}
          />
        )}

        {form.mode === 'upload' && (
          <QuoteUploadPanel
            phase={form.extractionPhase}
            fileName={form.extractionFileName}
            itemCount={form.extractionItemCount}
            uploadError={form.uploadError}
            onUpload={form.uploadQuote}
          />
        )}

        {/* Review banner once a PDF has been read */}
        {form.mode === 'upload' && form.extractionPhase === 'completed' && (
          <Alert variant="info" icon={<InfoIcon className="w-4 h-4" />}>
            <p>{t('guest.reviewBanner')}</p>
            {form.matchStats && form.matchStats.unmatched > 0 && (
              <p className="mt-1 text-sm">
                {t('guest.reviewUnmatched', { count: form.matchStats.unmatched })}
              </p>
            )}
          </Alert>
        )}

        {showForm && (
          <>
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
              substituteOpenIdx={null}
              substituteQuery=""
              onSubstituteQueryChange={() => {}}
              onOpenSubstitute={() => {}}
              onCloseSubstitute={() => {}}
              onSelectSubstitute={() => {}}
            />

            <AdditionalQuoteDetails
              validityPeriod={form.validityPeriod}
              onValidityPeriodChange={form.setValidityPeriod}
              paymentTerms={form.paymentTerms}
              onPaymentTermsChange={form.setPaymentTerms}
              additionalNotes={form.additionalNotes}
              onAdditionalNotesChange={form.setAdditionalNotes}
              attachments={[]}
              onFileUpload={() => {}}
              onRemoveAttachment={() => {}}
              uploadError={null}
              isUploading={false}
            />
          </>
        )}
      </div>

      {/* ═══ Success Modal ═══ */}
      {showSuccessModal && (
        <GridModal
          onClose={() => setShowSuccessModal(false)}
          icon={<FileTextIcon className="size-6 text-gray-700" />}
          title={t('guest.successTitle')}
          description={t('guest.successDescription')}
        >
          <p className="text-sm text-muted-foreground text-center">{t('guest.successHint')}</p>
        </GridModal>
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
