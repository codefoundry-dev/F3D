import { useTranslation } from '@forethread/i18n';
import {
  Input,
  FormField,
  CustomDropdown,
  DatePicker,
  Checkbox,
  onDigitsOnly,
} from '@forethread/ui-components';
import {
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFieldArrayReturn,
  Controller,
} from 'react-hook-form';

import { PoDeliveriesSection } from './PoDeliveriesSection';

import type { FormValues } from '../schemas/create-po.schema';

interface PoBasicInfoStepProps {
  register: UseFormRegister<FormValues>;
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
  vendorOptions: { value: string; label: string }[];
  projectOptions: { value: string; label: string }[];
  locationOptions: { value: string; label: string }[];
  watchedProjectId: string;
  lockedFields?: Set<string>;
  /** FOR-210: multi-delivery field-array controls. */
  deliveryFields: UseFieldArrayReturn<FormValues, 'deliveries'>['fields'];
  appendDelivery: UseFieldArrayReturn<FormValues, 'deliveries'>['append'];
  removeDelivery: UseFieldArrayReturn<FormValues, 'deliveries'>['remove'];
}

export function PoBasicInfoStep({
  register,
  control,
  errors,
  vendorOptions,
  projectOptions,
  locationOptions,
  watchedProjectId,
  lockedFields,
  deliveryFields,
  appendDelivery,
  removeDelivery,
}: PoBasicInfoStepProps) {
  const { t } = useTranslation('purchaseOrders');

  // Only lock a field if it's in lockedFields AND has a non-empty value
  const isLocked = (field: string, value: unknown) => !!lockedFields?.has(field) && !!value;

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-lg sm:text-[22px] font-medium leading-6 sm:leading-4 text-foreground">
          Step 1 of 3: {t('create.step1Title')}
        </h2>
        <p className="text-sm text-muted-foreground mt-2">{t('create.step1Subtitle')}</p>
      </div>

      <div className="bg-background border border-border rounded-lg p-4 sm:p-6">
        <div className="flex flex-col gap-6">
          {/* Row 1: Document name + Vendors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 lg:gap-x-[104px] gap-y-6">
            <div>
              <FormField
                label={t('create.documentName')}
                required
                error={errors.documentName?.message}
              >
                <Input
                  {...register('documentName')}
                  placeholder={t('create.documentNamePlaceholder')}
                />
              </FormField>
              <p className="text-xs text-muted-foreground mt-2">{t('create.documentNameHint')}</p>
            </div>

            <div>
              <FormField label={t('create.vendor')} optional error={errors.vendorId?.message}>
                <Controller
                  name="vendorId"
                  control={control}
                  render={({ field }) => (
                    <CustomDropdown
                      options={vendorOptions}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder={t('create.vendorPlaceholder')}
                      searchable
                      error={!!errors.vendorId}
                      disabled={isLocked('vendorId', field.value)}
                    />
                  )}
                />
              </FormField>
            </div>
          </div>

          {/* Row 2: Project + Payment terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 lg:gap-x-[104px] gap-y-6">
            <div>
              <FormField label={t('create.project')} required error={errors.projectId?.message}>
                <Controller
                  name="projectId"
                  control={control}
                  render={({ field }) => (
                    <CustomDropdown
                      options={projectOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t('create.projectPlaceholder')}
                      searchable
                      error={!!errors.projectId}
                      disabled={isLocked('projectId', field.value)}
                    />
                  )}
                />
              </FormField>
              <p className="text-xs text-muted-foreground mt-2">{t('create.projectHint')}</p>
            </div>

            <div>
              <FormField
                label={t('create.paymentTerms')}
                optional
                error={errors.paymentTermsDays?.message}
              >
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  onKeyDown={onDigitsOnly}
                  {...register('paymentTermsDays', {
                    setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                  })}
                  placeholder={t('create.paymentTermsPlaceholder')}
                />
              </FormField>
            </div>
          </div>

          {/* Row 3: Delivery location + Expected delivery date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 lg:gap-x-[104px] gap-y-6">
            <div>
              <FormField
                label={t('create.deliveryLocation')}
                required
                error={errors.deliveryLocationId?.message}
              >
                <Controller
                  name="deliveryLocationId"
                  control={control}
                  render={({ field }) => (
                    <CustomDropdown
                      options={locationOptions}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder={t('create.deliveryLocationPlaceholder')}
                      disabled={!watchedProjectId || isLocked('deliveryLocationId', field.value)}
                      error={!!errors.deliveryLocationId}
                    />
                  )}
                />
              </FormField>
            </div>

            <div>
              <FormField
                label={t('create.expectedDeliveryDate')}
                required
                error={errors.plannedDeliveryDate?.message}
              >
                <Controller
                  control={control}
                  name="plannedDeliveryDate"
                  render={({ field }) => (
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      minDate={new Date().toISOString().split('T')[0]}
                      disabled={isLocked('plannedDeliveryDate', field.value)}
                    />
                  )}
                />
              </FormField>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-3">
              <Controller
                name="pickUp"
                control={control}
                render={({ field }) => (
                  <Checkbox checked={field.value ?? false} onChange={field.onChange} />
                )}
              />
              <div className="flex flex-col">
                <span className="text-base text-foreground">{t('create.pickUpOrder')}</span>
                <span className="text-xs text-muted-foreground">{t('create.pickUpOrderHint')}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Controller
                name="holdForRelease"
                control={control}
                render={({ field }) => (
                  <Checkbox checked={field.value ?? false} onChange={field.onChange} />
                )}
              />
              <span className="text-base text-foreground">{t('create.holdForRelease')}</span>
            </div>
          </div>

          {/* FOR-210: Multi-delivery schedule */}
          <div className="border-t border-border pt-6">
            <PoDeliveriesSection
              register={register}
              control={control}
              errors={errors}
              fields={deliveryFields}
              append={appendDelivery}
              remove={removeDelivery}
              locationOptions={locationOptions}
              watchedProjectId={watchedProjectId}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
