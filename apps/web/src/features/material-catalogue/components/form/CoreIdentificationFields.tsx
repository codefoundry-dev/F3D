import { type MaterialCategoryDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { type MaterialFormValues } from '@forethread/shared-types/client';
import {
  Button,
  CustomDropdown,
  type DropdownOption,
  FormField,
  Input,
  onDecimalOnly,
  Textarea,
} from '@forethread/ui-components';
import UploadIcon from '@forethread/ui-components/assets/icons/upload.svg?react';
import { Controller, useFormContext } from 'react-hook-form';

import {
  colourOptions,
  countryOptions,
  currencyOptions,
  gradeClassOptions,
  itemTypeOptions,
  materialTypeOptions,
  standardNormOptions,
  uomOptions,
  withValue,
} from '../../lib/materialFormOptions';

export interface CoreIdentificationFieldsProps {
  categories: MaterialCategoryDto[];
}

/**
 * The "Core Identification" card — shared by the create wizard's Step 1 and the
 * Edit Core identification page (US 4.01 Phase 2). Binds to the surrounding
 * `useForm<MaterialFormValues>` context.
 *
 * Photo upload has no backend yet, so the "Upload photo" button is a disabled,
 * non-functional affordance; `imageUrl` stays on the form but there is no
 * uploader.
 */
export function CoreIdentificationFields({ categories }: CoreIdentificationFieldsProps) {
  const { t } = useTranslation(['materialCatalogue']);
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<MaterialFormValues>();

  const categoryOptions: DropdownOption[] = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const f = (key: string) => t(`form.fields.${key}` as 'form.fields.materialName');

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-base font-semibold text-foreground">{t('form.coreIdentification')}</h2>

      <div className="mt-5 flex flex-col gap-8 lg:flex-row">
        {/* ── Photo ────────────────────────────────────────────────── */}
        <div className="lg:w-72 flex-shrink-0">
          <p className="text-sm font-medium text-foreground mb-2">{t('form.photo')}</p>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start">
            <div className="w-48 aspect-[3/4] rounded-lg border border-border flex items-center justify-center text-sm text-muted-foreground">
              {t('form.imagePlaceholder')}
            </div>
            <div className="flex flex-col items-start gap-2">
              <Button
                type="button"
                variant="outline"
                disabled
                leftIcon={<UploadIcon className="w-4 h-4" />}
                data-testid="material-form-upload-photo"
              >
                {t('form.uploadPhoto')}
              </Button>
              <p className="text-xs text-muted-foreground">{t('form.uploadHint')}</p>
            </div>
          </div>
        </div>

        {/* ── Fields ───────────────────────────────────────────────── */}
        <div className="flex-1 space-y-5">
          <FormField
            label={f('materialName')}
            required
            error={errors.name?.message}
            htmlFor="material-name"
          >
            <Input
              id="material-name"
              {...register('name')}
              placeholder={f('materialNamePlaceholder')}
              data-testid="material-form-name"
            />
          </FormField>

          <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            <FormField label={f('category')} required error={errors.categoryId?.message}>
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <CustomDropdown
                    options={categoryOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t('form.selectCategory')}
                    error={Boolean(errors.categoryId)}
                    searchable
                  />
                )}
              />
            </FormField>

            <FormField label={f('materialType')} optional>
              <Controller
                name="materialType"
                control={control}
                render={({ field }) => (
                  <CustomDropdown
                    options={withValue(materialTypeOptions, field.value)}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder={t('form.selectMaterialType')}
                  />
                )}
              />
            </FormField>

            <FormField label={f('unitOfMeasure')} required error={errors.uom?.message}>
              <Controller
                name="uom"
                control={control}
                render={({ field }) => (
                  <CustomDropdown
                    options={withValue(uomOptions, field.value)}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t('form.selectUom')}
                    error={Boolean(errors.uom)}
                  />
                )}
              />
            </FormField>

            <FormField label={f('itemType')} optional>
              <Controller
                name="itemType"
                control={control}
                render={({ field }) => (
                  <CustomDropdown
                    options={withValue(itemTypeOptions, field.value)}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder={t('form.selectItemType')}
                  />
                )}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label={f('manufacturer')} optional>
              <Input {...register('manufacturer')} placeholder={f('manufacturerPlaceholder')} />
            </FormField>
            <FormField label={f('seriesModel')} optional>
              <Input
                {...register('manufacturerSeriesModel')}
                placeholder={f('seriesModelPlaceholder')}
              />
            </FormField>
            <FormField label={f('mpn')} optional>
              <Input {...register('manufacturerPartNumber')} placeholder={f('mpnPlaceholder')} />
            </FormField>
            <FormField
              label={f('countryOfOrigin')}
              required
              error={errors.countryOfOrigin?.message}
            >
              <Controller
                name="countryOfOrigin"
                control={control}
                render={({ field }) => (
                  <CustomDropdown
                    options={withValue(countryOptions, field.value)}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t('form.selectCountry')}
                    error={Boolean(errors.countryOfOrigin)}
                    searchable
                  />
                )}
              />
            </FormField>

            <FormField label={f('upc')} optional>
              <Input {...register('upc')} placeholder={f('upcPlaceholder')} />
            </FormField>
            <FormField label={f('sku')} optional>
              <Input {...register('sku')} placeholder={f('skuPlaceholder')} />
            </FormField>
            <FormField label={f('gradeClass')} optional>
              <Controller
                name="gradeClass"
                control={control}
                render={({ field }) => (
                  <CustomDropdown
                    options={withValue(gradeClassOptions, field.value)}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder={t('form.selectGradeClass')}
                  />
                )}
              />
            </FormField>
            <FormField label={f('standardNorm')} optional>
              <Controller
                name="standardNorm"
                control={control}
                render={({ field }) => (
                  <CustomDropdown
                    options={withValue(standardNormOptions, field.value)}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder={t('form.selectStandardNorm')}
                  />
                )}
              />
            </FormField>

            <FormField label={f('colourFinish')} optional>
              <Controller
                name="colourFinish"
                control={control}
                render={({ field }) => (
                  <CustomDropdown
                    options={withValue(colourOptions, field.value)}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder={t('form.selectColour')}
                  />
                )}
              />
            </FormField>
            <FormField label={f('size')} optional>
              <Input {...register('size')} placeholder={f('sizePlaceholder')} />
            </FormField>
            <FormField label={f('pricePerUnit')} optional error={errors.pricePerUnit?.message}>
              <Input
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                onKeyDown={onDecimalOnly}
                {...register('pricePerUnit')}
                placeholder={f('pricePlaceholder')}
                data-testid="material-form-price"
              />
            </FormField>
            <FormField label={f('currency')} optional>
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <CustomDropdown
                    options={withValue(currencyOptions, field.value)}
                    value={field.value ?? 'AUD'}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormField>
          </div>

          <FormField label={f('description')} optional>
            <Textarea
              {...register('description')}
              rows={3}
              placeholder={f('descriptionPlaceholder')}
            />
          </FormField>
        </div>
      </div>
    </section>
  );
}
