import { useTranslation } from '@forethread/i18n';
import { type MaterialFormValues } from '@forethread/shared-types/client';
import {
  CustomDropdown,
  type DropdownOption,
  FormField,
  Input,
  onDecimalOnly,
} from '@forethread/ui-components';
import { useEffect } from 'react';
import { Controller, type Path, useFormContext, useWatch } from 'react-hook-form';

import { FieldIcon } from '../../icons/fieldIcons';
import {
  lengthUomOptions,
  packagingUnitOptions,
  volumeUomOptions,
  weightUomOptions,
  withValue,
} from '../../lib/materialFormOptions';
import {
  ALL_SPECIFIC_DATA_KEYS,
  resolveSpecificSchema,
  type SpecificField,
} from '../../lib/specificDataSchema';

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
        <div className="min-w-0 flex-1">
          <Input
            leftIcon={<FieldIcon field={axis} />}
            inputMode="decimal"
            pattern="[0-9]*\.?[0-9]*"
            onKeyDown={onDecimalOnly}
            {...register(valuePath)}
            placeholder={t('form.enterNumber')}
            data-testid={`material-form-dim-${axis}`}
          />
        </div>
        <div className="w-28 flex-shrink-0">
          <Controller
            name={uomPath}
            control={control}
            render={({ field }) => (
              <CustomDropdown
                leftIcon={<FieldIcon field="uom" />}
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

/** snake/camelCase key → a stable, hyphenated test id segment. */
function toKebab(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * One "Specific data" control, rendered from its {@link SpecificField} schema
 * entry. Binds to `specificData.<key>` on the surrounding form. Free text by
 * default; a dropdown for `select` fields and a Yes/No choice for `boolean`.
 */
function SpecificDataField({ field }: { field: SpecificField }) {
  const { t } = useTranslation(['materialCatalogue']);
  const { control, register } = useFormContext<MaterialFormValues>();
  const path = `specificData.${field.key}` as Path<MaterialFormValues>;
  const testId = `material-form-${toKebab(field.key)}`;

  if (field.type === 'select') {
    const options: DropdownOption[] = (field.options ?? []).map((o) => ({ value: o, label: o }));
    return (
      <FormField label={field.label}>
        <Controller
          name={path}
          control={control}
          render={({ field: ctrl }) => (
            <CustomDropdown
              leftIcon={<FieldIcon field={field.key} />}
              options={withValue(options, ctrl.value as string | undefined)}
              value={(ctrl.value as string | undefined) ?? ''}
              onChange={ctrl.onChange}
              placeholder={t('form.select')}
            />
          )}
        />
      </FormField>
    );
  }

  if (field.type === 'boolean') {
    return (
      <FormField label={field.label}>
        <div className="flex items-center gap-6 pt-2" data-testid={testId}>
          {['Yes', 'No'].map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 text-sm text-foreground cursor-pointer"
            >
              <input
                type="radio"
                value={opt}
                {...register(path)}
                className="h-4 w-4 accent-primary"
              />
              {opt}
            </label>
          ))}
        </div>
      </FormField>
    );
  }

  return (
    <FormField label={field.label}>
      <Input
        leftIcon={<FieldIcon field={field.key} />}
        {...register(path)}
        placeholder={t('form.enter')}
        data-testid={testId}
      />
    </FormField>
  );
}

export interface AdditionalPropertiesFieldsProps {
  /** Categories used to resolve the selected `categoryId` to a name, which in
   *  turn drives which "Specific data" attributes are shown. */
  categories?: ReadonlyArray<{ id: string; name: string }>;
}

/**
 * The "Additional Properties" sections — Dimensions, Packaging & Handling, and
 * Specific data — shared by the create wizard's Step 2 and the Edit Additional
 * Properties page (US 4.01 Phase 2). Binds to the surrounding
 * `useForm<MaterialFormValues>` context.
 *
 * The Dimensions + Packaging cards are fixed; the "Specific data" card is
 * CATEGORY-DRIVEN — its fields come from {@link resolveSpecificSchema} for the
 * selected category (Figma "Category specific data" A–I, node 5411:96868).
 */
export function AdditionalPropertiesFields({ categories = [] }: AdditionalPropertiesFieldsProps) {
  const { t } = useTranslation(['materialCatalogue']);
  const { control, register, setValue, getValues } = useFormContext<MaterialFormValues>();

  const f = (key: string) => t(`form.fields.${key}` as 'form.fields.materialName');

  // Resolve the active "Specific data" schema from the selected category.
  const categoryId = useWatch({ control, name: 'categoryId' });
  const categoryName = categories.find((c) => c.id === categoryId)?.name;
  const schema = resolveSpecificSchema(categoryName);

  // Reconcile `specificData` whenever the active schema changes so the form
  // state always mirrors the visible fields: preserve custom keys not owned by
  // any schema (e.g. bulk-imported attributes), carry over / initialise the
  // active schema's fields, and drop keys belonging to a *different* category's
  // schema (so switching category never submits stale attributes).
  useEffect(() => {
    const current = getValues('specificData') ?? {};
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(current)) {
      if (!ALL_SPECIFIC_DATA_KEYS.has(key)) next[key] = value;
    }
    for (const specificField of schema.fields) {
      next[specificField.key] = current[specificField.key] ?? '';
    }
    setValue('specificData', next, { shouldDirty: false, shouldValidate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.id]);

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
                    leftIcon={<FieldIcon field="packagingUnit" />}
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
                leftIcon={<FieldIcon field="unitsPerPackage" />}
                inputMode="numeric"
                pattern="[0-9]*"
                {...register('dimensions.packaging.unitsPerPackage')}
                placeholder={t('form.enterNumber')}
                data-testid="material-form-units-per-package"
              />
            </FormField>
            <FormField label={f('weightPerPackage')}>
              <Input
                leftIcon={<FieldIcon field="weightPerPackage" />}
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

      {/* ── Specific data (category-driven) ───────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">{t('form.specificData')}</h2>
        <div
          className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4"
          data-testid="material-form-specific-data"
        >
          {schema.fields.map((specificField) => (
            <SpecificDataField key={specificField.key} field={specificField} />
          ))}
        </div>
      </section>
    </div>
  );
}
