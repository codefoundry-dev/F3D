import { useTranslation } from '@forethread/i18n';
import { Button, FormField, CustomDropdown, DatePicker, Textarea } from '@forethread/ui-components';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import {
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFieldArrayReturn,
  Controller,
} from 'react-hook-form';

import { EMPTY_DELIVERY_ROW } from '../schemas/create-po.schema';
import type { FormValues } from '../schemas/create-po.schema';

interface PoDeliveriesSectionProps {
  register: UseFormRegister<FormValues>;
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
  fields: UseFieldArrayReturn<FormValues, 'deliveries'>['fields'];
  append: UseFieldArrayReturn<FormValues, 'deliveries'>['append'];
  remove: UseFieldArrayReturn<FormValues, 'deliveries'>['remove'];
  locationOptions: { value: string; label: string }[];
  watchedProjectId: string;
}

/**
 * FOR-210: repeatable header-level delivery rows (location + date + notes).
 * Mirrors the line-item add/remove UX. Each row is optional; the backend
 * enforces that a non-empty row carries at least a location or a date.
 */
export function PoDeliveriesSection({
  register,
  control,
  errors,
  fields,
  append,
  remove,
  locationOptions,
  watchedProjectId,
}: PoDeliveriesSectionProps) {
  const { t } = useTranslation('purchaseOrders');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-medium text-foreground">{t('create.deliveriesTitle')}</h3>
        <p className="text-xs text-muted-foreground">{t('create.deliveriesSubtitle')}</p>
      </div>

      <div className="flex flex-col gap-4">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="rounded-lg border border-border bg-background p-4 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {t('create.deliveryRow', { index: index + 1 })}
              </span>
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="flex items-center gap-1 text-sm text-foreground hover:text-foreground/70 transition-colors"
                  aria-label={t('create.removeDelivery')}
                >
                  <DeleteIcon className="w-[18px] h-[18px]" />
                  {t('create.removeDelivery')}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 lg:gap-x-[104px] gap-y-6">
              <FormField
                label={t('create.deliveryLocation')}
                optional
                error={errors.deliveries?.[index]?.deliveryLocationId?.message}
              >
                <Controller
                  name={`deliveries.${index}.deliveryLocationId`}
                  control={control}
                  render={({ field: f }) => (
                    <CustomDropdown
                      options={locationOptions}
                      value={f.value ?? ''}
                      onChange={f.onChange}
                      placeholder={t('create.deliveryLocationPlaceholder')}
                      disabled={!watchedProjectId}
                      error={!!errors.deliveries?.[index]?.deliveryLocationId}
                    />
                  )}
                />
              </FormField>

              <FormField
                label={t('create.expectedDeliveryDate')}
                optional
                error={errors.deliveries?.[index]?.deliveryDate?.message}
              >
                <Controller
                  name={`deliveries.${index}.deliveryDate`}
                  control={control}
                  render={({ field: f }) => (
                    <DatePicker
                      value={f.value ?? ''}
                      onChange={f.onChange}
                      minDate={new Date().toISOString().split('T')[0]}
                    />
                  )}
                />
              </FormField>
            </div>

            <FormField label={t('create.deliveryNotes')} optional>
              <Textarea
                {...register(`deliveries.${index}.notes`)}
                rows={2}
                placeholder={t('create.deliveryNotesPlaceholder')}
              />
            </FormField>
          </div>
        ))}
      </div>

      <div>
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => append({ ...EMPTY_DELIVERY_ROW })}
        >
          {t('create.addDelivery')}
        </Button>
      </div>
    </div>
  );
}
