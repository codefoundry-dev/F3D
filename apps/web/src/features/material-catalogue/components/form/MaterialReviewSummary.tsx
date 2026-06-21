import { type MaterialCategoryDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { type MaterialFormValues } from '@forethread/shared-types/client';
import { Button } from '@forethread/ui-components';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import ImageIcon from '@forethread/ui-components/assets/icons/image.svg?react';
import { type ReactNode } from 'react';

import { FieldIcon } from '../../icons/fieldIcons';
import { formatPrice } from '../../lib/format';
import { specificDataLabel } from '../../lib/specificDataSchema';

const DASH = '—';

function val(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return DASH;
  return String(v);
}

/** Render a `{ value, uom }` dimension axis as "12 mm", or "—". */
function dim(entry: { value?: string; uom?: string } | undefined): string {
  const value = entry?.value?.trim();
  if (!value) return DASH;
  const uom = entry?.uom?.trim();
  return uom ? `${value} ${uom}` : value;
}

function Field({ label, field, children }: { label: string; field?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2 text-sm text-foreground">
        {field && (
          <span className="shrink-0 text-gray-500">
            <FieldIcon field={field} />
          </span>
        )}
        <span className="min-w-0 break-words">{children}</span>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground">{children}</h3>;
}

export interface MaterialReviewSummaryProps {
  values: MaterialFormValues;
  categories: MaterialCategoryDto[];
  onEditCore: () => void;
  onEditAdditional: () => void;
}

/**
 * Read-only review of the entered values (create wizard Step 3). Mirrors the
 * material detail page — image on the left, an iconified label/value grid on the
 * right. Each card's "Edit" link jumps back to the relevant wizard step.
 * System-assigned fields (Internal ID, Status, Last modified) are omitted here
 * since the material does not exist yet.
 */
export function MaterialReviewSummary({
  values,
  categories,
  onEditCore,
  onEditAdditional,
}: MaterialReviewSummaryProps) {
  const { t } = useTranslation(['materialCatalogue']);
  const f = (key: string) => t(`form.fields.${key}` as 'form.fields.materialName');

  const categoryName = categories.find((c) => c.id === values.categoryId)?.name ?? DASH;
  const dims = values.dimensions;
  const packaging = dims?.packaging;

  const properties = Object.entries(values.specificData ?? {}).filter(([, v]) => v?.trim());

  const price = values.pricePerUnit?.trim()
    ? `${formatPrice(values.pricePerUnit, values.currency)}${
        values.currency ? ` ${values.currency}` : ''
      }`
    : DASH;

  return (
    <div className="space-y-6">
      {/* ── Core identification ───────────────────────────────────────── */}
      <section
        className="rounded-2xl border border-border bg-card p-6"
        data-testid="material-review-core"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            {t('create.step3.coreIdentification')}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={<EditIcon className="h-4 w-4" />}
            onClick={onEditCore}
            data-testid="material-review-edit-core"
          >
            {t('create.step3.edit')}
          </Button>
        </div>

        <div className="mt-5 flex flex-col gap-6 lg:flex-row">
          <div className="flex aspect-[4/5] items-center justify-center rounded-xl border border-[#e8eaed] bg-[#f9f9fa] text-gray-300 lg:w-72 lg:flex-shrink-0">
            <ImageIcon className="size-14" />
          </div>

          <div className="grid flex-1 grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={f('materialName')} field="name">
              {val(values.name)}
            </Field>
            <Field label={f('category')} field="category">
              {val(categoryName)}
            </Field>
            <Field label={f('materialType')} field="materialType">
              {val(values.materialType)}
            </Field>
            <Field label={f('unitOfMeasure')} field="uom">
              {val(values.uom)}
            </Field>
            <Field label={f('itemType')} field="itemType">
              {val(values.itemType)}
            </Field>
            <Field label={f('countryOfOrigin')} field="countryOfOrigin">
              {val(values.countryOfOrigin)}
            </Field>
            <Field label={f('manufacturer')} field="manufacturer">
              {val(values.manufacturer)}
            </Field>
            <Field label={f('seriesModel')} field="seriesModel">
              {val(values.manufacturerSeriesModel)}
            </Field>
            <Field label={f('mpn')} field="mpn">
              {val(values.manufacturerPartNumber)}
            </Field>
            <Field label={f('upc')} field="upc">
              {val(values.upc)}
            </Field>
            <Field label={f('sku')} field="sku">
              {val(values.sku)}
            </Field>
            <Field label={f('gradeClass')} field="gradeClass">
              {val(values.gradeClass)}
            </Field>
            <Field label={f('standardNorm')} field="standardNorm">
              {val(values.standardNorm)}
            </Field>
            <Field label={f('colourFinish')} field="colourFinish">
              {val(values.colourFinish)}
            </Field>
            <Field label={f('size')} field="size">
              {val(values.size)}
            </Field>
            <Field label={f('pricePerUnit')} field="pricePerUnit">
              {price}
            </Field>
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <Field label={f('description')} field="description">
            {val(values.description)}
          </Field>
        </div>
      </section>

      {/* ── Additional properties ─────────────────────────────────────── */}
      <section
        className="space-y-6 rounded-2xl border border-border bg-card p-6"
        data-testid="material-review-additional"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            {t('create.step3.additionalProperties')}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={<EditIcon className="h-4 w-4" />}
            onClick={onEditAdditional}
            data-testid="material-review-edit-additional"
          >
            {t('create.step3.edit')}
          </Button>
        </div>

        <div className="space-y-4">
          <SectionTitle>{t('form.dimensions')}</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            <Field label={f('length')} field="length">
              {dim(dims?.length)}
            </Field>
            <Field label={f('width')} field="width">
              {dim(dims?.width)}
            </Field>
            <Field label={f('height')} field="height">
              {dim(dims?.height)}
            </Field>
            <Field label={f('diameter')} field="diameter">
              {dim(dims?.diameter)}
            </Field>
            <Field label={f('thickness')} field="thickness">
              {dim(dims?.thickness)}
            </Field>
            <Field label={f('volume')} field="volume">
              {dim(dims?.volume)}
            </Field>
            <Field label={f('weightPerUnit')} field="weightPerUnit">
              {dim(dims?.weightPerUnit)}
            </Field>
          </div>
        </div>

        <div className="space-y-4 border-t border-border pt-4">
          <SectionTitle>{t('form.packaging')}</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
            <Field label={f('unitsPerPackage')} field="unitsPerPackage">
              {val(packaging?.unitsPerPackage)}
            </Field>
            <Field label={f('packagingUnit')} field="packagingUnit">
              {val(packaging?.packagingUnit)}
            </Field>
            <Field label={f('weightPerPackage')} field="weightPerPackage">
              {val(packaging?.weightPerPackage)}
            </Field>
          </div>
        </div>

        {properties.length > 0 && (
          <div className="space-y-4 border-t border-border pt-4">
            <SectionTitle>{t('form.specificData')}</SectionTitle>
            <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
              {properties.map(([key, value]) => (
                <Field key={key} label={specificDataLabel(key)} field={key}>
                  {val(value)}
                </Field>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
