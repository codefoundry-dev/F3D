import type {
  CreatePurchaseOrderInput,
  CreatePoChangeRequestInput,
  PoDetail,
  ProjectDetail,
  VendorAssignment,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Button,
  MobileActionBar,
  StatusSuccessModal,
  StatusErrorModal,
  useIsPhone,
} from '@forethread/ui-components';
import { useCallback, useEffect, useMemo } from 'react';

import { usePoDropdownOptions } from '../hooks/usePoDropdownOptions';
import { usePoWizardForm } from '../hooks/usePoWizardForm';

import { PoBasicInfoStep } from './PoBasicInfoStep';
import { PoChangeReviewStep } from './PoChangeReviewStep';
import { PoCreateLineItemsStep } from './PoCreateLineItemsStep';
import { PoReviewStep } from './PoReviewStep';
import { Stepper } from './Stepper';
import { scrollToFirstInvalid, useWizardChrome } from './wizard-chrome';

import type { FormValues, PoCreationMode } from '../schemas/create-po.schema';

export interface CreatePoWizardProps {
  onNavigateBack: () => void;
  onSuccess: () => void;
  projectsData?: { items: { id: string; name: string }[] };
  vendorsData?: VendorAssignment[];
  projectDetail?: ProjectDetail | null;
  onProjectIdChange: (id: string) => void;
  onCreatePo: (
    input: CreatePurchaseOrderInput,
    callbacks: { onSuccess: (po: { id: string }) => void; onError: () => void },
  ) => void;
  isCreating: boolean;
  initialValues?: Partial<FormValues>;
  lockedFields?: Set<string>;
  /** Creation mode: manual, from-rfq, or from-bulk-order */
  creationMode?: PoCreationMode;
  /**
   * US 5.09 drawdown: the source bulk order id. When set together with
   * `creationMode='from-bulk-order'`, the wizard runs in drawdown mode — it
   * forwards `bulkOrderId` + per-line `bulkOrderLineItemId` to the create
   * payload, shows the "Available qty" column + reduction banner on step 2,
   * and switches the success modal to "Back to Bulk orders".
   */
  bulkOrderId?: string;
  /** Human-readable bulk order number (e.g. "BULK-2025-011") for drawdown copy. */
  bulkOrderNumber?: string;
  /**
   * FLOW 3 — wizard mode. `'create'` (default) creates a new PO; `'change'`
   * pre-fills from `existingPo`, locks the document name, and Step 3 becomes the
   * diff review that submits a PO change request via `onProposeChange`.
   */
  mode?: 'create' | 'change';
  /** FLOW 3 change mode: the PO being changed (source of the diff). */
  existingPo?: PoDetail;
  /** FLOW 3 change mode: submit the computed change request. */
  onProposeChange?: (
    input: CreatePoChangeRequestInput,
    callbacks: { onSuccess: () => void; onError: () => void },
  ) => void;
  /** FLOW 3 change mode: loading flag for the "Submit PO changes" button. */
  isSubmittingChange?: boolean;
  /**
   * FOR-398: the company's default PO terms & conditions, prefilled into the
   * review step once loaded (`undefined` while loading; `null` = none set).
   */
  defaultTermsAndConditions?: string | null;
}

export function CreatePoWizard({
  onNavigateBack,
  onSuccess,
  projectsData,
  vendorsData,
  projectDetail,
  onProjectIdChange,
  onCreatePo,
  isCreating,
  initialValues,
  lockedFields,
  creationMode = 'manual',
  bulkOrderId,
  bulkOrderNumber,
  mode = 'create',
  existingPo,
  onProposeChange,
  isSubmittingChange,
  defaultTermsAndConditions,
}: CreatePoWizardProps) {
  const { t } = useTranslation('purchaseOrders');

  const isDrawdown = creationMode === 'from-bulk-order' && Boolean(bulkOrderId);
  const isChange = mode === 'change';

  // Change mode locks the document name (PO identity is immutable) on top of any
  // caller-supplied locks.
  const effectiveLockedFields = useMemo(() => {
    if (!isChange) return lockedFields;
    const next = new Set(lockedFields ?? []);
    next.add('documentName');
    return next;
  }, [isChange, lockedFields]);

  const {
    step,
    form,
    fields,
    append,
    remove,
    deliveryFields,
    appendDelivery,
    removeDelivery,
    canContinue,
    handleContinue,
    handleBack,
    onSubmit,
    handleSaveDraft,
    showSuccess,
    showError,
    setShowError,
    totalItems,
    totalQty,
    subtotal,
    setStep,
    attachments,
    addAttachments,
    removeAttachment,
    changedFields,
    submitChange,
  } = usePoWizardForm({
    onNavigateBack,
    onCreatePo,
    projectDetail,
    noLineItemsMsg: t('create.noLineItems'),
    drawdownExceedsMsg: t('create.drawdownExceedsRemaining'),
    initialValues,
    creationMode,
    bulkOrderId,
    mode,
    existingPo,
    onProposeChange,
    noChangesMsg: t('change.noChanges'),
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = form;

  // Phones (ADR-0019 B8): no bottom nav, back arrow confirms unsaved changes,
  // and Back / Save draft / Next live in the fixed footer bar.
  const isPhone = useIsPhone();
  const { exitConfirm } = useWizardChrome({ isDirty, onExit: onNavigateBack });

  // Change mode: seed the project / vendor / locations this PO already points at
  // so the prefilled dropdowns render their real label even before the fetched
  // lists land — or if the PO's values fall outside them (paginated project
  // list, a delivery location since removed from the project). The PO detail is
  // the only place these names are available; line-level locations ship as a
  // bare id, so those still resolve from the project list alone.
  const existingPoProjects = useMemo(
    () => (existingPo ? [{ id: existingPo.projectId, name: existingPo.projectName }] : undefined),
    [existingPo],
  );
  const existingPoVendors = useMemo(
    () =>
      existingPo?.vendor ? [{ id: existingPo.vendor.id, name: existingPo.vendor.name }] : undefined,
    [existingPo],
  );
  const existingPoLocations = useMemo(() => {
    if (!existingPo) return undefined;
    return [
      { id: existingPo.deliveryLocationId, name: existingPo.deliveryLocationName },
      ...(existingPo.deliveries ?? []).map((d) => ({
        id: d.deliveryLocationId,
        name: d.deliveryLocationName,
      })),
    ];
  }, [existingPo]);

  const { projectOptions, vendorOptions, locationOptions } = usePoDropdownOptions({
    projectsData,
    vendorsData,
    projectDetail,
    extraProjects: existingPoProjects,
    extraVendors: existingPoVendors,
    extraLocations: existingPoLocations,
  });

  // Prefill the company's T&Cs once they arrive, unless the field already holds
  // a value (from initialValues or an earlier prefill).
  useEffect(() => {
    if (isChange || defaultTermsAndConditions === undefined) return;
    if (form.getValues('termsAndConditions') !== undefined) return;
    setValue('termsAndConditions', defaultTermsAndConditions ?? '');
  }, [isChange, defaultTermsAndConditions, form, setValue]);

  const watchedProjectId = watch('projectId');
  const watchedVendorId = watch('vendorId');

  // Notify parent when projectId changes
  useEffect(() => {
    onProjectIdChange(watchedProjectId);
  }, [watchedProjectId, onProjectIdChange]);

  const handleVendorSuggested = useCallback(
    (suggestedVendorId: string) => {
      // Only auto-set vendor if none is selected yet
      if (!watchedVendorId) {
        setValue('vendorId', suggestedVendorId);
      }
    },
    [watchedVendorId, setValue],
  );

  const stepLabels = [t('create.stepLabel1'), t('create.stepLabel2'), t('create.stepLabel3')];

  const saveDraftButton = isChange ? null : (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={handleSaveDraft}
      isLoading={isCreating}
    >
      {t('create.saveDraft')}
    </Button>
  );
  const backButton = (
    <Button
      type="button"
      variant="outline"
      size="lg"
      leftIcon={<span>&larr;</span>}
      onClick={handleBack}
    >
      {t('create.back')}
    </Button>
  );
  const nextButton =
    step < 3 ? (
      <Button
        type="button"
        variant="primary"
        size="lg"
        rightIcon={<span>&rarr;</span>}
        disabled={!canContinue}
        onClick={() => void handleContinue()}
      >
        {t('create.continue')}
      </Button>
    ) : isChange ? (
      <Button
        type="button"
        variant="primary"
        size="lg"
        isLoading={isSubmittingChange}
        onClick={() => submitChange()}
      >
        {t('change.submitChanges')}
      </Button>
    ) : (
      <Button
        type="button"
        variant="primary"
        size="lg"
        isLoading={isCreating}
        onClick={() => void handleSubmit(onSubmit, () => scrollToFirstInvalid())()}
      >
        {t('create.submitPo')}
      </Button>
    );

  return (
    <div className="p-4 flex flex-col flex-1 min-h-full bg-secondary">
      <Stepper step={step} labels={stepLabels} />

      <div className="flex flex-col flex-1 justify-between pt-8">
        {step === 1 && (
          <PoBasicInfoStep
            register={register}
            control={control}
            errors={errors}
            vendorOptions={vendorOptions}
            projectOptions={projectOptions}
            locationOptions={locationOptions}
            watchedProjectId={watchedProjectId}
            lockedFields={effectiveLockedFields}
            deliveryFields={deliveryFields}
            appendDelivery={appendDelivery}
            removeDelivery={removeDelivery}
          />
        )}

        {step === 2 && (
          <PoCreateLineItemsStep
            register={register}
            control={control}
            errors={errors}
            fields={fields}
            append={append}
            remove={remove}
            setValue={setValue}
            locationOptions={locationOptions}
            totalItems={totalItems}
            totalQty={totalQty}
            vendorId={watchedVendorId}
            projectId={watchedProjectId}
            isManualMode={creationMode === 'manual'}
            onVendorSuggested={handleVendorSuggested}
            isDrawdownMode={isDrawdown}
            bulkOrderNumber={bulkOrderNumber}
          />
        )}

        {step === 3 &&
          (isChange ? (
            <PoChangeReviewStep
              changedFields={changedFields}
              poLineItems={existingPo?.lineItems}
              register={register}
              locationOptions={locationOptions}
              onEditStep={setStep}
            />
          ) : (
            <PoReviewStep
              watch={watch}
              projectDetail={projectDetail ?? undefined}
              vendorsData={vendorsData}
              locationOptions={locationOptions}
              subtotal={subtotal}
              totalItems={totalItems}
              totalQty={totalQty}
              register={register}
              onEditStep={setStep}
              attachments={attachments}
              onAddAttachments={addAttachments}
              onRemoveAttachment={removeAttachment}
            />
          ))}

        {/* Footer */}
        {isPhone ? (
          <MobileActionBar>
            {backButton}
            {saveDraftButton}
            {nextButton}
          </MobileActionBar>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mt-8 gap-3">
            {/* Change mode has no draft; keep the row right-aligned with a spacer. */}
            {saveDraftButton ?? <span className="hidden sm:block" />}

            <div className="flex items-center gap-3 sm:gap-4 justify-end">
              {backButton}
              {nextButton}
            </div>
          </div>
        )}
      </div>

      {exitConfirm}

      {showSuccess && isChange && (
        <StatusSuccessModal
          onClose={onSuccess}
          title={t('change.title')}
          description={t('change.submitSuccess')}
          buttonLabel={t('create.backToPOs')}
          redirectLabel={(s) => t('create.redirectingGeneric', { seconds: s })}
        />
      )}

      {showSuccess && !isChange && (
        <StatusSuccessModal
          onClose={onSuccess}
          title={t('create.successTitle')}
          description={isDrawdown ? t('create.drawdownSuccessMessage') : t('create.successMessage')}
          buttonLabel={isDrawdown ? t('create.backToBulkOrders') : t('create.backToPOs')}
          redirectLabel={(s) =>
            isDrawdown
              ? t('create.redirectingGeneric', { seconds: s })
              : t('create.redirecting', { seconds: s })
          }
        />
      )}

      {showError && (
        <StatusErrorModal
          onClose={() => setShowError(false)}
          title={isChange ? t('change.title') : t('create.errorTitle')}
          description={isChange ? t('change.submitError') : t('create.errorMessage')}
          primaryButtonLabel={t('create.tryAgain')}
          onPrimaryClick={() => {
            setShowError(false);
            if (isChange) submitChange();
            else void handleSubmit(onSubmit)();
          }}
          secondaryButtonLabel={isChange ? undefined : t('create.saveDraft')}
          onSecondaryClick={
            isChange
              ? undefined
              : () => {
                  setShowError(false);
                  handleSaveDraft();
                }
          }
        />
      )}
    </div>
  );
}
