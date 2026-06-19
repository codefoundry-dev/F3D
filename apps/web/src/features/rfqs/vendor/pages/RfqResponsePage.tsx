import {
  type MaterialListItemDto,
  type QuoteResponseDetail,
  addWarehouse,
  getQuoteDetail,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { useRfq } from '@forethread/rfq-shared';
import {
  Alert,
  Button,
  Modal,
  ModalBody,
  ModalIconHeader,
  Spinner,
  StatusErrorModal,
} from '@forethread/ui-components';
import ClockIcon from '@forethread/ui-components/assets/icons/clock-icon.svg?react';
import FileTextIcon from '@forethread/ui-components/assets/icons/file-text.svg?react';
import PaperPlaneIcon from '@forethread/ui-components/assets/icons/paper-plane.svg?react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useAuthStore } from '@/features/auth/state/auth.store';

import { AdditionalQuoteDetails } from '../components/AdditionalQuoteDetails';
import { AddWarehouseModal } from '../components/AddWarehouseModal';
import { BulkLevelDefaults } from '../components/BulkLevelDefaults';
import { ResponseLineItemsTable } from '../components/ResponseLineItemsTable';
import { RfqResponseInfoPanel } from '../components/RfqResponseInfoPanel';
import { useCanRespond } from '../hooks/useCanRespond';
import { useFileUpload } from '../hooks/useFileUpload';
import { useRfqResponse } from '../hooks/useRfqResponse';

export default function RfqResponsePage() {
  const { t } = useTranslation('rfqs');
  const { id } = useParams<{ id: string }>();
  const companyId = useAuthStore((s) => s.currentUser?.companyId) ?? '';
  const { data: rfq, isLoading, isError } = useRfq(id ?? '');

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

  return <RfqResponseContent rfq={rfq} vendorId={companyId} />;
}

/* ─── Main Content ─────────────────────────────────────────────────────────── */

function RfqResponseContent({
  rfq,
  vendorId,
}: {
  rfq: NonNullable<ReturnType<typeof useRfq>['data']>;
  vendorId: string;
}) {
  // Detect edit mode: if vendor already responded, load the existing quote
  const { canEdit, existingQuoteId } = useCanRespond(rfq);

  const { data: existingQuote, isLoading: quoteLoading } = useQuery({
    queryKey: ['quote-detail', rfq.id, existingQuoteId],
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    queryFn: () => getQuoteDetail(rfq.id, existingQuoteId!),
    enabled: canEdit && !!existingQuoteId,
  });

  // Wait for existing quote to load when in edit mode
  if (canEdit && quoteLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <RfqResponseForm
      rfq={rfq}
      vendorId={vendorId}
      existingQuote={canEdit ? (existingQuote ?? null) : null}
    />
  );
}

/* ─── Form ─────────────────────────────────────────────────────────────────── */

function RfqResponseForm({
  rfq,
  vendorId,
  existingQuote,
}: {
  rfq: NonNullable<ReturnType<typeof useRfq>['data']>;
  vendorId: string;
  existingQuote: QuoteResponseDetail | null;
}) {
  const { t } = useTranslation('rfqs');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = useRfqResponse(rfq, vendorId, { existingQuote });
  const initialAttachments = useMemo(
    () =>
      existingQuote?.attachments?.map((a) => ({ id: a.fileId, name: a.filename ?? a.fileId })) ??
      [],
    [existingQuote],
  );
  const { attachments, uploadError, isUploading, handleFileUpload, removeAttachment } =
    useFileUpload(initialAttachments);

  // Material search state (inline substitute search in the line items table)
  const [substituteOpenIdx, setSubstituteOpenIdx] = useState<number | null>(null);
  const [substituteQuery, setSubstituteQuery] = useState('');

  // Warehouse modal state
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [warehouseSubmitting, setWarehouseSubmitting] = useState(false);

  const handleAddWarehouse = useCallback(
    async (input: { name: string; address: string; city: string; postcode: string }) => {
      setWarehouseSubmitting(true);
      try {
        const wh = await addWarehouse(vendorId, input);
        await queryClient.invalidateQueries({ queryKey: ['vendor-profile', vendorId] });
        form.setBulkField('warehouseLocationId', wh.id);
        setShowWarehouseModal(false);
      } finally {
        setWarehouseSubmitting(false);
      }
    },
    [vendorId, form, queryClient],
  );

  // Modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);

  useEffect(() => {
    if (form.submitSuccess) setShowSuccessModal(true);
  }, [form.submitSuccess]);

  useEffect(() => {
    if (form.submitError) setShowErrorModal(true);
  }, [form.submitError]);

  const handleSelectSubstitute = useCallback(
    (material: MaterialListItemDto) => {
      if (substituteOpenIdx === null) return;
      form.updateLineItem(substituteOpenIdx, 'substituteItemId', material.id);
      form.updateLineItem(substituteOpenIdx, 'substituteName', material.name);
      setSubstituteOpenIdx(null);
      setSubstituteQuery('');
    },
    [substituteOpenIdx, form],
  );

  const handleOpenSubstitute = useCallback((idx: number) => {
    setSubstituteOpenIdx(idx);
    setSubstituteQuery('');
  }, []);

  const handleCloseSubstitute = useCallback(() => {
    setSubstituteOpenIdx(null);
    setSubstituteQuery('');
  }, []);

  // Transient "draft saved" confirmation
  const [showDraftSaved, setShowDraftSaved] = useState(false);
  const handleSaveDraft = useCallback(() => {
    form.saveDraft();
    setShowDraftSaved(true);
  }, [form]);

  useEffect(() => {
    if (!showDraftSaved) return;
    const timer = setTimeout(() => setShowDraftSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [showDraftSaved]);

  // Deadline calculation
  const deadlineDate = rfq.deadlineEnd ? new Date(rfq.deadlineEnd) : null;
  const daysLeft = deadlineDate
    ? Math.max(0, Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  const deadlineExpired = deadlineDate ? deadlineDate.getTime() < Date.now() : false;
  const deadlineDisplay = deadlineDate
    ? deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div className="flex flex-col h-full w-full">
      {/* ═══ Top bar ═══ */}
      <div className="px-4 sm:px-8 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Deadline alert */}
          <Alert variant="info" icon={<ClockIcon className="w-4 h-4" />}>
            {deadlineExpired
              ? t('response.deadlineExpired')
              : t('response.deadlineBanner', { date: deadlineDisplay, daysLeft })}
          </Alert>

          {/* View info toggle — shown only while the panel is closed (the panel has its own ✕) */}
          {!form.showInfo && (
            <Button
              variant="outline"
              size="md"
              className="h-[42px]"
              onClick={() => form.setShowInfo(true)}
            >
              {t('response.viewInfo')}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {showDraftSaved && (
            <span className="text-sm text-success whitespace-nowrap">
              {t('response.draftSaved')}
            </span>
          )}
          <Button
            variant="primary"
            size="md"
            className="h-[42px]"
            leftIcon={<PaperPlaneIcon className="w-[18px] h-[18px]" />}
            onClick={() => void form.handleSubmit()}
            disabled={form.isSubmitting || !form.isValid}
          >
            {form.isSubmitting
              ? t(form.isEditMode ? 'response.updating' : 'response.submitting')
              : t(form.isEditMode ? 'response.update' : 'response.submit')}
          </Button>
          {!form.isEditMode && (
            <Button
              variant="outline"
              size="md"
              className="h-[42px]"
              onClick={handleSaveDraft}
              disabled={form.isSubmitting}
            >
              {t('response.saveAsDraft')}
            </Button>
          )}
        </div>
      </div>

      {/* ═══ Validation error ═══ */}
      {form.validationError && (
        <div className="px-4 sm:px-8 pb-2">
          <Alert variant="destructive">{t(form.validationError as never)}</Alert>
        </div>
      )}

      {/* ═══ Main content area ═══ */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-8">
        <div className={form.showInfo ? 'flex gap-4' : ''}>
          {/* Left panel – RFQ info (when visible) */}
          {form.showInfo && (
            <div className="w-[380px] shrink-0">
              <RfqResponseInfoPanel rfq={rfq} onClose={() => form.setShowInfo(false)} />
            </div>
          )}

          {/* Right panel – Form */}
          <div className="flex-1 space-y-4 min-w-0">
            {/* Bulk defaults */}
            <BulkLevelDefaults
              bulkDefaults={form.bulkDefaults}
              onFieldChange={form.setBulkField}
              expanded={form.bulkExpanded}
              onToggleExpanded={form.setBulkExpanded}
              warehouses={form.warehouses}
              warehousesLoading={form.warehousesLoading}
              onAddWarehouse={() => setShowWarehouseModal(true)}
            />

            {/* Line items table (with inline substitute search) */}
            <ResponseLineItemsTable
              lineItems={form.lineItems}
              onToggleInclude={form.toggleInclude}
              onUpdateItem={form.updateLineItem}
              onToggleExpanded={form.toggleExpanded}
              totals={form.totals}
              substituteOpenIdx={substituteOpenIdx}
              substituteQuery={substituteQuery}
              onSubstituteQueryChange={setSubstituteQuery}
              onOpenSubstitute={handleOpenSubstitute}
              onCloseSubstitute={handleCloseSubstitute}
              onSelectSubstitute={handleSelectSubstitute}
            />

            {/* Additional details */}
            <AdditionalQuoteDetails
              validityPeriod={form.validityPeriod}
              onValidityPeriodChange={form.setValidityPeriod}
              additionalNotes={form.additionalNotes}
              onAdditionalNotesChange={form.setAdditionalNotes}
              attachments={attachments}
              onFileUpload={(file) => void handleFileUpload(file, form.addAttachment)}
              onRemoveAttachment={(id) => {
                removeAttachment(id);
                form.removeAttachment(id);
              }}
              uploadError={uploadError}
              isUploading={isUploading}
            />
          </div>
        </div>
      </div>

      {/* ═══ Success Modal ═══ */}
      {showSuccessModal && (
        <Modal onClose={() => setShowSuccessModal(false)}>
          <ModalBody>
            <ModalIconHeader
              icon={<FileTextIcon className="w-6 h-6 text-foreground" />}
              title={t(form.isEditMode ? 'response.updateSuccessTitle' : 'response.successTitle')}
              subtitle={t(
                form.isEditMode
                  ? 'response.updateSuccessDescription'
                  : 'response.successDescription',
                {
                  rfqId: rfq.rfqNumber ?? rfq.id,
                  contractorName: rfq.createdBy.name,
                },
              )}
              onClose={() => setShowSuccessModal(false)}
            />
            <div className="flex flex-col gap-3 mt-5">
              <Button
                className="w-full"
                onClick={() => {
                  void queryClient.invalidateQueries({ queryKey: ['rfqs'] });
                  setShowSuccessModal(false);
                  navigate(ROUTES.rfqDetail.replace(':id', rfq.id));
                }}
              >
                {t('response.backToRfq')}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  void queryClient.invalidateQueries({ queryKey: ['rfqs'] });
                  setShowSuccessModal(false);
                  navigate(ROUTES.home);
                }}
              >
                {t('response.goToDashboard')}
              </Button>
            </div>
          </ModalBody>
        </Modal>
      )}

      {/* ═══ Error Modal ═══ */}
      {showErrorModal && (
        <StatusErrorModal
          onClose={() => setShowErrorModal(false)}
          title={t(form.isEditMode ? 'response.updateErrorTitle' : 'response.errorTitle')}
          description={t(
            form.isEditMode ? 'response.updateErrorDescription' : 'response.errorDescription',
            { rfqId: rfq.rfqNumber ?? rfq.id },
          )}
          primaryButtonLabel={t('response.backToRfq')}
          onPrimaryClick={() => {
            setShowErrorModal(false);
            navigate(ROUTES.rfqDetail.replace(':id', rfq.id));
          }}
          secondaryButtonLabel={form.isEditMode ? undefined : t('response.saveAsDraft')}
          onSecondaryClick={
            form.isEditMode
              ? undefined
              : () => {
                  handleSaveDraft();
                  setShowErrorModal(false);
                }
          }
        />
      )}

      {/* ═══ Add Warehouse Modal ═══ */}
      {showWarehouseModal && (
        <AddWarehouseModal
          onClose={() => setShowWarehouseModal(false)}
          onSubmit={(input) => void handleAddWarehouse(input)}
          isSubmitting={warehouseSubmitting}
        />
      )}
    </div>
  );
}
