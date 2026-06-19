import { type MaterialCategoryDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { type MaterialFormValues } from '@forethread/shared-types/client';
import { Button } from '@forethread/ui-components';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import { type ReactNode } from 'react';

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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm text-foreground break-words">{children}</div>
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
 * label/value style of the material detail page. Each card's "Edit" link jumps
 * back to the relevant wizard step.
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
        className="rounded-xl border border-border bg-card p-6"
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
            leftIcon={<EditIcon className="w-4 h-4" />}
            onClick={onEditCore}
            data-testid="material-review-edit-core"
          >
            {t('create.step3.edit')}
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={f('materialName')}>{val(values.name)}</Field>
          <Field label={f('category')}>{val(categoryName)}</Field>
          <Field label={f('materialType')}>{val(values.materialType)}</Field>
          <Field label={f('unitOfMeasure')}>{val(values.uom)}</Field>
          <Field label={f('itemType')}>{val(values.itemType)}</Field>
          <Field label={f('countryOfOrigin')}>{val(values.countryOfOrigin)}</Field>
          <Field label={f('manufacturer')}>{val(values.manufacturer)}</Field>
          <Field label={f('mpn')}>{val(values.manufacturerPartNumber)}</Field>
          <Field label={f('seriesModel')}>{val(values.manufacturerSeriesModel)}</Field>
          <Field label={f('upc')}>{val(values.upc)}</Field>
          <Field label={f('sku')}>{val(values.sku)}</Field>
          <Field label={f('gradeClass')}>{val(values.gradeClass)}</Field>
          <Field label={f('standardNorm')}>{val(values.standardNorm)}</Field>
          <Field label={f('colourFinish')}>{val(values.colourFinish)}</Field>
          <Field label={f('size')}>{val(values.size)}</Field>
          <Field label={f('pricePerUnit')}>{price}</Field>
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <Field label={f('description')}>{val(values.description)}</Field>
        </div>
      </section>

      {/* ── Additional properties ─────────────────────────────────────── */}
      <section
        className="rounded-xl border border-border bg-card p-6 space-y-6"
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
            leftIcon={<EditIcon className="w-4 h-4" />}
            onClick={onEditAdditional}
            data-testid="material-review-edit-additional"
          >
            {t('create.step3.edit')}
          </Button>
        </div>

        <div className="space-y-4">
          <SectionTitle>{t('form.dimensions')}</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            <Field label={f('length')}>{dim(dims?.length)}</Field>
            <Field label={f('width')}>{dim(dims?.width)}</Field>
            <Field label={f('height')}>{dim(dims?.height)}</Field>
            <Field label={f('diameter')}>{dim(dims?.diameter)}</Field>
            <Field label={f('thickness')}>{dim(dims?.thickness)}</Field>
            <Field label={f('volume')}>{dim(dims?.volume)}</Field>
            <Field label={f('weightPerUnit')}>{dim(dims?.weightPerUnit)}</Field>
          </div>
        </div>

        <div className="space-y-4 border-t border-border pt-4">
          <SectionTitle>{t('form.packaging')}</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
            <Field label={f('unitsPerPackage')}>{val(packaging?.unitsPerPackage)}</Field>
            <Field label={f('packagingUnit')}>{val(packaging?.packagingUnit)}</Field>
            <Field label={f('weightPerPackage')}>{val(packaging?.weightPerPackage)}</Field>
          </div>
        </div>

        {properties.length > 0 && (
          <div className="space-y-4 border-t border-border pt-4">
            <SectionTitle>{t('form.specificData')}</SectionTitle>
            <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
              {properties.map(([key, value]) => (
                <Field key={key} label={specificDataLabel(key)}>
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
