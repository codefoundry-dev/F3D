import { useTranslation } from '@forethread/i18n';
import { type MaterialFormValues } from '@forethread/shared-types/client';
import {
  CustomDropdown,
  type DropdownOption,
  FormField,
  Input,
  onDecimalOnly,
} from '@forethread/ui-components';
import { Controller, type Path, useFormContext } from 'react-hook-form';

import {
  lengthUomOptions,
  packagingUnitOptions,
  volumeUomOptions,
  weightUomOptions,
  withValue,
} from '../../lib/materialFormOptions';

type DimensionAxis =
  | 'length'
  | 'width'
  | 'height'
  | 'diameter'
  | 'thickness'
  | 'volume'
  | 'weightPerUnit';

/** A `number + UoM dropdown` pair for one dimension axis. */
function DimensionRow({
  axis,
  label,
  uomOptions,
}: {
  axis: DimensionAxis;
  label: string;
  uomOptions: DropdownOption[];
}) {
  const { t } = useTranslation(['materialCatalogue']);
  const { control, register } = useFormContext<MaterialFormValues>();
  const valuePath = `dimensions.${axis}.value` as Path<MaterialFormValues>;
  const uomPath = `dimensions.${axis}.uom` as Path<MaterialFormValues>;

  return (
    <FormField label={label}>
      <div className="flex gap-2">
        <Input
          inputMode="decimal"
          pattern="[0-9]*\.?[0-9]*"
          onKeyDown={onDecimalOnly}
          {...register(valuePath)}
          placeholder={t('form.enterNumber')}
          className="flex-1"
          data-testid={`material-form-dim-${axis}`}
        />
        <div className="w-32 flex-shrink-0">
          <Controller
            name={uomPath}
            control={control}
            render={({ field }) => (
              <CustomDropdown
                options={withValue(uomOptions, field.value as string | undefined)}
                value={(field.value as string | undefined) ?? ''}
                onChange={field.onChange}
                placeholder={t('form.select')}
              />
            )}
          />
        </div>
      </div>
    </FormField>
  );
}

/**
 * The "Additional Properties" sections — Dimensions, Packaging & Handling, and
 * Specific data — shared by the create wizard's Step 2 and the Edit Additional
 * Properties page (US 4.01 Phase 2). Binds to the surrounding
 * `useForm<MaterialFormValues>` context.
 */
export function AdditionalPropertiesFields() {
  const { t } = useTranslation(['materialCatalogue']);
  const { control, register } = useFormContext<MaterialFormValues>();

  const f = (key: string) => t(`form.fields.${key}` as 'form.fields.materialName');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Dimensions ─────────────────────────────────────────────── */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground">{t('form.dimensions')}</h2>
          <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            <DimensionRow axis="length" label={f('length')} uomOptions={lengthUomOptions} />
            <DimensionRow axis="width" label={f('width')} uomOptions={lengthUomOptions} />
            <DimensionRow axis="height" label={f('height')} uomOptions={lengthUomOptions} />
            <DimensionRow axis="diameter" label={f('diameter')} uomOptions={lengthUomOptions} />
            <DimensionRow axis="thickness" label={f('thickness')} uomOptions={lengthUomOptions} />
            <DimensionRow axis="volume" label={f('volume')} uomOptions={volumeUomOptions} />
            <DimensionRow
              axis="weightPerUnit"
              label={f('weightPerUnit')}
              uomOptions={weightUomOptions}
            />
          </div>
        </section>

        {/* ── Packaging & Handling ───────────────────────────────────── */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground">{t('form.packaging')}</h2>
          <div className="mt-5 space-y-5">
            <FormField label={f('packagingUnit')}>
              <Controller
                name="dimensions.packaging.packagingUnit"
                control={control}
                render={({ field }) => (
                  <CustomDropdown
                    options={withValue(packagingUnitOptions, field.value)}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder={t('form.select')}
                  />
                )}
              />
            </FormField>
            <FormField label={f('unitsPerPackage')}>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                {...register('dimensions.packaging.unitsPerPackage')}
                placeholder={t('form.enterNumber')}
                data-testid="material-form-units-per-package"
              />
            </FormField>
            <FormField label={f('weightPerPackage')}>
              <Input
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                onKeyDown={onDecimalOnly}
                {...register('dimensions.packaging.weightPerPackage')}
                placeholder={t('form.enterNumber')}
                data-testid="material-form-weight-per-package"
              />
            </FormField>
          </div>
        </section>
      </div>

      {/* ── Specific data ──────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">{t('form.specificData')}</h2>
        <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label={f('compressiveStrength')}>
            <Input
              {...register('specificData.compressiveStrength')}
              placeholder={t('form.enter')}
              data-testid="material-form-compressive-strength"
            />
          </FormField>
          <FormField label={f('tensileStrength')}>
            <Input {...register('specificData.tensileStrength')} placeholder={t('form.enter')} />
          </FormField>
          <FormField label={f('fireRating')}>
            <Input {...register('specificData.fireRating')} placeholder={t('form.enter')} />
          </FormField>
          <FormField label={f('density')}>
            <Input {...register('specificData.density')} placeholder={t('form.enter')} />
          </FormField>
        </div>
      </section>
    </div>
  );
}
