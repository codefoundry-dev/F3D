import { type MaterialDetailDto, type MaterialDimensions } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Button } from '@forethread/ui-components';
import BackArrowIcon from '@forethread/ui-components/assets/icons/back-arrow.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import { type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { usePermissions } from '@/shared/role';

import { MaterialStatusBadge } from '../components/MaterialStatusBadge';
import { useMaterial } from '../hooks/useMaterial';
import { formatLongDate, formatPrice } from '../lib/format';
import { specificDataLabel } from '../lib/specificDataSchema';

const DASH = '—';

function val(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return DASH;
  return String(v);
}

function dim(d: MaterialDimensions | null, key: keyof MaterialDimensions): string {
  if (!d) return DASH;
  const entry = d[key];
  if (!entry || typeof entry !== 'object') return DASH;
  if ('value' in entry) {
    if (entry.value === null || entry.value === undefined) return DASH;
    return entry.uom ? `${entry.value} ${entry.uom}` : String(entry.value);
  }
  return DASH;
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

export default function MaterialDetailPage() {
  const { t } = useTranslation(['materialCatalogue']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { has } = usePermissions();
  const { data, isLoading, isError } = useMaterial(id);

  if (isLoading) {
    return (
      <div className="p-8">
        <p role="status" className="text-muted-foreground">
          {t('detail.loading')}
        </p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8 space-y-4">
        <button
          type="button"
          onClick={() => navigate(ROUTES.materialCatalogue)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <BackArrowIcon className="w-4 h-4" />
          {t('detail.back')}
        </button>
        <p role="alert" className="text-destructive">
          {t('detail.notFound')}
        </p>
      </div>
    );
  }

  const material: MaterialDetailDto = data;
  const internalId = material.sku ?? material.id;
  const editCorePath = ROUTES.materialCatalogueEdit.replace(':id', material.id);
  const editAdditionalPath = ROUTES.materialCatalogueEditAdditional.replace(':id', material.id);
  const canEdit = has('material.update');

  const EditButton = ({ to }: { to: string }) =>
    canEdit ? (
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<EditIcon className="w-4 h-4" />}
        onClick={() => navigate(to)}
        data-testid="material-detail-edit"
      >
        {t('detail.edit')}
      </Button>
    ) : null;

  const properties = material.properties
    ? Object.entries(material.properties).filter(
        ([, v]) => v !== null && v !== undefined && v !== '',
      )
    : [];

  return (
    <div className="p-8 space-y-6" data-testid="material-detail">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate(ROUTES.materialCatalogue)}
          className="mt-1 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
          aria-label={t('detail.back')}
          data-testid="material-detail-back"
        >
          <BackArrowIcon className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{material.name}</h1>
          <p className="text-sm text-muted-foreground">{internalId}</p>
        </div>
      </div>

      {/* ── Core identification ─────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            {t('detail.coreIdentification')}
          </h2>
          <EditButton to={editCorePath} />
        </div>

        <div className="mt-5 flex flex-col gap-6 lg:flex-row">
          <div className="lg:w-64 flex-shrink-0">
            {material.imageUrl ? (
              <img
                src={material.imageUrl}
                alt={material.name}
                className="w-full aspect-[3/4] object-cover rounded-lg border border-border"
              />
            ) : (
              <div className="w-full aspect-[3/4] rounded-lg border border-border flex items-center justify-center text-sm text-muted-foreground">
                {t('detail.imagePlaceholder')}
              </div>
            )}
          </div>

          <div className="flex-1 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t('detail.fields.internalId')}>{val(internalId)}</Field>
            {/* No dedicated "material code" column exists on the catalogue model;
                the SKU is the material's code, so we surface it here too. */}
            <Field label={t('detail.fields.materialCode')}>{val(material.sku)}</Field>
            <Field label={t('detail.fields.materialName')}>{val(material.name)}</Field>
            <Field label={t('detail.fields.status')}>
              <MaterialStatusBadge status={material.status} />
            </Field>
            <Field label={t('detail.fields.categories')}>{val(material.categoryName)}</Field>
            <Field label={t('detail.fields.materialType')}>{val(material.materialType)}</Field>
            <Field label={t('detail.fields.unitOfMeasure')}>{val(material.uom)}</Field>
            <Field label={t('detail.fields.itemType')}>{val(material.itemType)}</Field>
            <Field label={t('detail.fields.countryOfOrigin')}>
              {val(material.countryOfOrigin)}
            </Field>
            <Field label={t('detail.fields.manufacturer')}>
              {val(material.manufacturer ?? material.brand)}
            </Field>
            <Field label={t('detail.fields.mpn')}>{val(material.manufacturerPartNumber)}</Field>
            <Field label={t('detail.fields.seriesModel')}>
              {val(material.manufacturerSeriesModel)}
            </Field>
            <Field label={t('detail.fields.upc')}>{val(material.upc)}</Field>
            <Field label={t('detail.fields.sku')}>{val(material.sku)}</Field>
            <Field label={t('detail.fields.gradeClass')}>{val(material.gradeClass)}</Field>
            <Field label={t('detail.fields.colourFinish')}>{val(material.colourFinish)}</Field>
            <Field label={t('detail.fields.size')}>{val(material.size)}</Field>
            <Field label={t('detail.fields.pricePerUnit')}>
              {material.pricePerUnit
                ? `${formatPrice(material.pricePerUnit, material.currency)}${
                    material.currency ? ` ${material.currency}` : ''
                  }`
                : DASH}
            </Field>
            <Field label={t('detail.fields.lastModified')}>
              {formatLongDate(material.updatedAt)}
            </Field>
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <Field label={t('detail.fields.description')}>{val(material.description)}</Field>
        </div>
      </section>

      {/* ── Additional properties ───────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            {t('detail.additionalProperties')}
          </h2>
          <EditButton to={editAdditionalPath} />
        </div>

        <div className="space-y-4">
          <SectionTitle>{t('detail.dimensions')}</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            <Field label={t('detail.fields.length')}>{dim(material.dimensions, 'length')}</Field>
            <Field label={t('detail.fields.width')}>{dim(material.dimensions, 'width')}</Field>
            <Field label={t('detail.fields.height')}>{dim(material.dimensions, 'height')}</Field>
            <Field label={t('detail.fields.diameter')}>
              {dim(material.dimensions, 'diameter')}
            </Field>
            <Field label={t('detail.fields.thickness')}>
              {dim(material.dimensions, 'thickness')}
            </Field>
            <Field label={t('detail.fields.weightPerUnit')}>
              {dim(material.dimensions, 'weightPerUnit')}
            </Field>
          </div>
        </div>

        <div className="space-y-4 border-t border-border pt-4">
          <SectionTitle>{t('detail.packaging')}</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
            <Field label={t('detail.fields.unitsPerPackage')}>
              {val(material.dimensions?.packaging?.unitsPerPackage)}
            </Field>
            <Field label={t('detail.fields.packagingUnit')}>
              {val(material.dimensions?.packaging?.packagingUnit)}
            </Field>
            <Field label={t('detail.fields.weightPerPackage')}>
              {val(material.dimensions?.packaging?.weightPerPackage)}
            </Field>
          </div>
        </div>

        {properties.length > 0 && (
          <div className="space-y-4 border-t border-border pt-4">
            <SectionTitle>{t('detail.specificData')}</SectionTitle>
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
