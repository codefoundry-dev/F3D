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
import ImageIcon from '@forethread/ui-components/assets/icons/image.svg?react';
import { Controller, useFormContext } from 'react-hook-form';

import { FieldIcon } from '../../icons/fieldIcons';
import { TrashSimpleIcon, UploadSimpleIcon } from '../../icons/phosphor';
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
  /** Render the "Core Identification" card heading (create wizard step 1). The
   *  edit page hides it — the page header already names the material. */
  heading?: boolean;
}

/**
 * The "Core Identification" card — shared by the create wizard's Step 1 and the
 * Edit page (US 4.02). Binds to the surrounding `useForm<MaterialFormValues>`
 * context. Each control carries the Figma leading glyph (node 6625:151979).
 *
 * Photo upload has no backend yet, so the "Upload photo" button is a disabled,
 * non-functional affordance; `imageUrl` stays on the form but there is no
 * uploader.
 */
export function CoreIdentificationFields({
  categories,
  heading = true,
}: CoreIdentificationFieldsProps) {
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
    <section className="rounded-2xl border border-border bg-card p-6">
      {heading && (
        <h2 className="text-base font-semibold text-foreground">{t('form.coreIdentification')}</h2>
      )}

      {/* ── Photo + top fields ─────────────────────────────────────────── */}
      <div className={`flex flex-col gap-8 lg:flex-row ${heading ? 'mt-5' : ''}`}>
        {/* Photo */}
        <div className="flex flex-shrink-0 items-start gap-5">
          <div className="flex size-[150px] items-center justify-center rounded-xl border border-[#e8eaed] bg-[#f9f9fa] text-gray-300">
            <ImageIcon className="size-12" />
          </div>
          <div className="flex flex-col items-start gap-2 pt-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled
                leftIcon={<UploadSimpleIcon className="size-4" />}
                data-testid="material-form-upload-photo"
              >
                {t('form.uploadPhoto')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                iconOnly
                disabled
                aria-label={t('form.removePhoto')}
                data-testid="material-form-remove-photo"
              >
                <TrashSimpleIcon className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('form.uploadHint')}</p>
          </div>
        </div>

        {/* Name + the two paired dropdown rows */}
        <div className="flex-1 space-y-5">
          <FormField
            label={f('materialName')}
            required
            error={errors.name?.message}
            htmlFor="material-name"
          >
            <Input
              id="material-name"
              leftIcon={<FieldIcon field="name" />}
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
                    leftIcon={<FieldIcon field="category" />}
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
                    leftIcon={<FieldIcon field="materialType" />}
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
                    leftIcon={<FieldIcon field="uom" />}
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
                    leftIcon={<FieldIcon field="itemType" />}
                    options={withValue(itemTypeOptions, field.value)}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder={t('form.selectItemType')}
                  />
                )}
              />
            </FormField>
          </div>
        </div>
      </div>

      {/* ── Remaining identification fields (full-width 4-up grid) ───────── */}
      <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label={f('manufacturer')} optional>
          <Input
            leftIcon={<FieldIcon field="manufacturer" />}
            {...register('manufacturer')}
            placeholder={f('manufacturerPlaceholder')}
          />
        </FormField>
        <FormField label={f('seriesModel')} optional>
          <Input
            leftIcon={<FieldIcon field="seriesModel" />}
            {...register('manufacturerSeriesModel')}
            placeholder={f('seriesModelPlaceholder')}
          />
        </FormField>
        <FormField label={f('mpn')} optional>
          <Input
            leftIcon={<FieldIcon field="mpn" />}
            {...register('manufacturerPartNumber')}
            placeholder={f('mpnPlaceholder')}
          />
        </FormField>
        <FormField label={f('countryOfOrigin')} required error={errors.countryOfOrigin?.message}>
          <Controller
            name="countryOfOrigin"
            control={control}
            render={({ field }) => (
              <CustomDropdown
                leftIcon={<FieldIcon field="countryOfOrigin" />}
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
          <Input
            leftIcon={<FieldIcon field="upc" />}
            {...register('upc')}
            placeholder={f('upcPlaceholder')}
          />
        </FormField>
        <FormField label={f('sku')} optional>
          <Input
            leftIcon={<FieldIcon field="sku" />}
            {...register('sku')}
            placeholder={f('skuPlaceholder')}
          />
        </FormField>
        <FormField label={f('gradeClass')} optional>
          <Controller
            name="gradeClass"
            control={control}
            render={({ field }) => (
              <CustomDropdown
                leftIcon={<FieldIcon field="gradeClass" />}
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
                leftIcon={<FieldIcon field="standardNorm" />}
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
                leftIcon={<FieldIcon field="colourFinish" />}
                options={withValue(colourOptions, field.value)}
                value={field.value ?? ''}
                onChange={field.onChange}
                placeholder={t('form.selectColour')}
              />
            )}
          />
        </FormField>
        <FormField label={f('size')} optional>
          <Input
            leftIcon={<FieldIcon field="size" />}
            {...register('size')}
            placeholder={f('sizePlaceholder')}
          />
        </FormField>
        <FormField label={f('pricePerUnit')} optional error={errors.pricePerUnit?.message}>
          <Input
            leftIcon={<FieldIcon field="pricePerUnit" />}
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
                leftIcon={<FieldIcon field="currency" />}
                options={withValue(currencyOptions, field.value)}
                value={field.value ?? 'AUD'}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
      </div>

      {/* ── Description ─────────────────────────────────────────────────── */}
      <div className="mt-5">
        <FormField label={f('description')} optional>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-3 text-gray-500">
              <FieldIcon field="description" />
            </span>
            <Textarea
              {...register('description')}
              rows={3}
              placeholder={f('descriptionPlaceholder')}
              className="pl-9"
            />
          </div>
        </FormField>
      </div>
    </section>
  );
}
