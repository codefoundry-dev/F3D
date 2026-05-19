import {
  type CreatePurchaseOrderInput,
  type CreatePoLineItemInput,
  type ProjectLocationResponse,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Stepper,
  PoBasicInfoStep,
  PoCreateLineItemsStep,
  PoReviewStep,
  formSchema,
  EMPTY_LINE_ITEM,
  type FormValues,
} from '@forethread/po-shared';
import { PoType } from '@forethread/shared-types/client';
import {
  Button,
  notificationService,
  StatusSuccessModal,
  StatusErrorModal,
} from '@forethread/ui-components';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useCallback, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import {
  useProjectsList,
  useProjectDetail,
  useCompanyVendors,
  useCreatePurchaseOrder,
} from '../services/purchase-orders.service';

export default function CreatePurchaseOrderPage() {
  const { t } = useTranslation('purchaseOrders');
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);

  const createMutation = useCreatePurchaseOrder();
  const { data: projectsData } = useProjectsList();
  const { data: vendorsData } = useCompanyVendors();

  const {
    register,
    handleSubmit,
    control,
    watch,
    trigger,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      documentName: '',
      projectId: '',
      vendorId: '',
      paymentTermsDays: undefined,
      deliveryLocationId: '',
      plannedDeliveryDate: '',
      pickUp: false,
      holdForRelease: false,
      lineItems: [{ ...EMPTY_LINE_ITEM }],
      message: '',
    },
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lineItems',
  });

  const watchedProjectId = watch('projectId');
  const watchedLineItems = watch('lineItems');
  const { data: projectDetail } = useProjectDetail(watchedProjectId);

  // Project locations for delivery dropdown
  const deliveryLocations: ProjectLocationResponse[] = useMemo(
    () => projectDetail?.locations?.filter((l) => l.type === 'DELIVERY') ?? [],
    [projectDetail],
  );

  // Project options
  const projectOptions = useMemo(
    () => projectsData?.items.map((p) => ({ value: p.id, label: p.name })) ?? [],
    [projectsData],
  );

  // Vendor options
  const vendorOptions = useMemo(
    () =>
      vendorsData?.map((v) => ({ value: v.id, label: v.legalName ?? v.tradeName ?? v.id })) ?? [],
    [vendorsData],
  );

  // Location options
  const locationOptions = useMemo(
    () =>
      deliveryLocations.map((l) => ({
        value: l.id,
        label: l.label ?? l.address,
      })),
    [deliveryLocations],
  );

  // Totals
  const lineItemsList = watchedLineItems ?? [];
  const totalItems = lineItemsList.length;
  const totalQty = lineItemsList.reduce(
    (sum: number, item: FormValues['lineItems'][number]) =>
      sum + (Number(item.quantityOrdered) || 0),
    0,
  );
  const subtotal = lineItemsList.reduce(
    (sum: number, item: FormValues['lineItems'][number]) =>
      sum + (Number(item.unitPrice) || 0) * (Number(item.quantityOrdered) || 0),
    0,
  );

  // Step navigation
  const handleContinue = useCallback(async () => {
    if (step === 1) {
      const valid = await trigger(['documentName', 'projectId', 'plannedDeliveryDate']);
      if (valid) setStep(2);
    } else if (step === 2) {
      const valid = await trigger('lineItems');
      if (valid) setStep(3);
      else notificationService.error(t('create.noLineItems'));
    }
  }, [step, trigger, t]);

  const handleBack = useCallback(() => {
    if (step > 1) setStep((s) => s - 1);
    else navigate(ROUTES.purchaseOrders);
  }, [step, navigate]);

  // Submit
  const onSubmit = useCallback(
    (data: FormValues) => {
      const lineItems: CreatePoLineItemInput[] = data.lineItems.map((item) => ({
        materialId: '00000000-0000-0000-0000-000000000000', // placeholder — materials module not yet implemented
        materialCode: item.materialCode ?? undefined,
        description: item.description ?? undefined,
        quantityOrdered: item.quantityOrdered,
        unitOfMeasure: item.unitOfMeasure,
        unitPrice: item.unitPrice,
        costCode: item.costCode ?? undefined,
        notes: item.notes ?? undefined,
        expectedDeliveryDate: item.expectedDeliveryDate
          ? new Date(item.expectedDeliveryDate).toISOString()
          : undefined,
        deliveryLocationId: item.deliveryLocationId ?? undefined,
      }));

      const input: CreatePurchaseOrderInput = {
        projectId: data.projectId,
        vendorId: data.vendorId ?? vendorOptions[0]?.value ?? '',
        poType: data.holdForRelease ? PoType.HOLD_FOR_RELEASE : PoType.STANDARD,
        currency: projectDetail?.currency ?? 'AUD',
        pickUp: data.pickUp ?? false,
        holdForRelease: data.holdForRelease ?? false,
        deliveryLocationId: data.deliveryLocationId ?? undefined,
        paymentTermsDays: data.paymentTermsDays ?? undefined,
        plannedDeliveryDate: data.plannedDeliveryDate
          ? new Date(data.plannedDeliveryDate).toISOString()
          : undefined,
        deadlineStart: data.plannedDeliveryDate
          ? new Date(data.plannedDeliveryDate).toISOString()
          : undefined,
        message: data.message ?? undefined,
        lineItems,
      };

      createMutation.mutate(input, {
        onSuccess: () => setShowSuccess(true),
        onError: () => setShowError(true),
      });
    },
    [createMutation, vendorOptions, projectDetail],
  );

  // Save as draft — same as submit, just doesn't issue
  const handleSaveDraft = useCallback(() => {
    void handleSubmit((data) => {
      onSubmit(data);
    })();
  }, [handleSubmit, onSubmit]);

  const stepLabels = [t('create.stepLabel1'), t('create.stepLabel2'), t('create.stepLabel3')];

  return (
    <div className="p-4">
      {/* Stepper */}
      <Stepper step={step} labels={stepLabels} />

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        {step === 1 && (
          <PoBasicInfoStep
            register={register}
            control={control}
            errors={errors}
            vendorOptions={vendorOptions}
            projectOptions={projectOptions}
            locationOptions={locationOptions}
            watchedProjectId={watchedProjectId}
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
          />
        )}

        {step === 3 && (
          <PoReviewStep
            watch={watch}
            projectDetail={projectDetail}
            vendorsData={vendorsData}
            locationOptions={locationOptions}
            subtotal={subtotal}
            totalItems={totalItems}
            totalQty={totalQty}
            register={register}
          />
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleSaveDraft}
            isLoading={createMutation.isPending}
          >
            {t('create.saveDraft')}
          </Button>

          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" size="lg" onClick={handleBack}>
              &larr; {t('create.back')}
            </Button>

            {step < 3 ? (
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={() => void handleContinue()}
              >
                {t('create.continue')} &rarr;
              </Button>
            ) : (
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={createMutation.isPending}
              >
                {t('create.submitPo')} &#10003;
              </Button>
            )}
          </div>
        </div>
      </form>

      {/* Success Modal */}
      {showSuccess && (
        <StatusSuccessModal
          onClose={() => navigate(ROUTES.purchaseOrders)}
          title={t('create.successTitle')}
          description={t('create.successMessage')}
          buttonLabel={t('create.backToPOs')}
          redirectLabel={(s) => t('create.redirecting', { seconds: s })}
        />
      )}

      {/* Error Modal */}
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
