import type {
  CreatePurchaseOrderInput,
  ProjectDetail,
  VendorAssignment,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Button, StatusSuccessModal, StatusErrorModal } from '@forethread/ui-components';
import { useCallback, useEffect } from 'react';

import { usePoDropdownOptions } from '../hooks/usePoDropdownOptions';
import { usePoWizardForm } from '../hooks/usePoWizardForm';

import { PoBasicInfoStep } from './PoBasicInfoStep';
import { PoCreateLineItemsStep } from './PoCreateLineItemsStep';
import { PoReviewStep } from './PoReviewStep';
import { Stepper } from './Stepper';

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
}: CreatePoWizardProps) {
  const { t } = useTranslation('purchaseOrders');

  const {
    step,
    form,
    fields,
    append,
    remove,
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
  } = usePoWizardForm({
    onNavigateBack,
    onCreatePo,
    projectDetail,
    noLineItemsMsg: t('create.noLineItems'),
    initialValues,
    creationMode,
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const { projectOptions, vendorOptions, locationOptions } = usePoDropdownOptions({
    projectsData,
    vendorsData,
    projectDetail,
  });

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
            lockedFields={lockedFields}
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
          />
        )}

        {step === 3 && (
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
        )}

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mt-8 gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleSaveDraft}
            isLoading={isCreating}
          >
            {t('create.saveDraft')}
          </Button>

          <div className="flex items-center gap-3 sm:gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              size="lg"
              leftIcon={<span>&larr;</span>}
              onClick={handleBack}
            >
              {t('create.back')}
            </Button>

            {step < 3 ? (
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
            ) : (
              <Button
                type="button"
                variant="primary"
                size="lg"
                isLoading={isCreating}
                onClick={() => void handleSubmit(onSubmit)()}
              >
                {t('create.submitPo')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {showSuccess && (
        <StatusSuccessModal
          onClose={onSuccess}
          title={t('create.successTitle')}
          description={t('create.successMessage')}
          buttonLabel={t('create.backToPOs')}
          redirectLabel={(s) => t('create.redirecting', { seconds: s })}
        />
      )}

      {showError && (
        <StatusErrorModal
          onClose={() => setShowError(false)}
          title={t('create.errorTitle')}
          description={t('create.errorMessage')}
          primaryButtonLabel={t('create.tryAgain')}
          onPrimaryClick={() => {
            setShowError(false);
            void handleSubmit(onSubmit)();
          }}
          secondaryButtonLabel={t('create.saveDraft')}
          onSecondaryClick={() => {
            setShowError(false);
            handleSaveDraft();
          }}
        />
      )}
    </div>
  );
}
