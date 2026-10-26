import type { ProjectListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Checkbox, DatePicker, Input, SelectDropdown, todayIso } from '@forethread/ui-components';
import { useEffect } from 'react';

import { useProjectDeliveryLocations } from '../../services/rfqs.service';

import type { WizardBasicInfo, WizardFieldErrors } from './wizard-types';

interface StepBasicInfoProps {
  values: WizardBasicInfo;
  onChange: (patch: Partial<WizardBasicInfo>) => void;
  projects: ProjectListItem[];
  errors: WizardFieldErrors;
  /** Converting-a-project-BOM flow: the project is prefilled and locked. */
  projectLocked?: boolean;
}

function FieldLabel({
  label,
  required,
  optional,
}: {
  label: string;
  required?: boolean;
  optional?: string;
}) {
  return (
    <span className="flex items-center gap-1 text-sm font-medium text-foreground">
      {label}
      {required && <span className="text-destructive">*</span>}
      {optional && <span className="text-muted-foreground font-normal">({optional})</span>}
    </span>
  );
}

/**
 * Consolidated step 1 — "Fulfill information" card (Figma 5.05, frame
 * "1.3. RFQ manually - 1"). Two-column field grid; pick-up reveals a pick-up
 * location field, and "Hold for release" reveals the earliest allowed delivery
 * date (both per the design annotations). Delivery location is the RFQ-level
 * default — line items may still override it individually.
 */
export function StepBasicInfo({
  values,
  onChange,
  projects,
  errors,
  projectLocked = false,
}: StepBasicInfoProps) {
  const { t } = useTranslation('rfqs');

  const projectOptions = projects.map((p) => ({ value: p.id, label: p.name }));

  const requiredMsg = t('create.errors.required');
  // Every date here names a future event, so today is the floor (FOR: no back-dating).
  const minDate = todayIso();

  // Delivery locations belong to the primary project; the API rejects a
  // location outside the RFQ's projects.
  const primaryProjectId = values.projectIds[0];
  const { data: deliveryLocations = [], isLoading: locationsLoading } =
    useProjectDeliveryLocations(primaryProjectId);

  const locationOptions = deliveryLocations.map((loc) => ({
    value: loc.id,
    label: loc.label ? `${loc.label} — ${loc.address}` : loc.address,
  }));

  // Keep the selection valid as the project changes: default to the project's
  // default delivery location, and drop a stale id belonging to a project that
  // is no longer selected. Every write is guarded by a value comparison — the
  // parent's setState always produces a new object, so an unconditional
  // `onChange` here would re-render forever (e.g. a project with no delivery
  // locations, where the desired value stays '').
  useEffect(() => {
    if (locationsLoading) return;
    const current = values.deliveryLocationId;
    if (!primaryProjectId) {
      if (current) onChange({ deliveryLocationId: '' });
      return;
    }
    if (deliveryLocations.some((loc) => loc.id === current)) return;
    const fallback = deliveryLocations.find((loc) => loc.isDefault) ?? deliveryLocations[0];
    const next = fallback?.id ?? '';
    if (next !== current) onChange({ deliveryLocationId: next });
    // `onChange` is a fresh closure each render — depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryProjectId, deliveryLocations, locationsLoading, values.deliveryLocationId]);

  return (
    <section className="bg-card rounded-lg border border-border p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground leading-[22px]">
          {t('create.basicInfo.cardTitle')}
        </h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {t('create.basicInfo.cardSubtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        {/* Row 1 — reference / response deadline */}
        <div className="flex flex-col gap-1.5">
          <FieldLabel label={t('create.basicInfo.reference')} required />
          <Input
            value={values.documentName}
            onChange={(e) => onChange({ documentName: e.target.value })}
            placeholder={t('create.basicInfo.referencePlaceholder')}
            data-testid="rfq-reference"
          />
          {errors.documentName ? (
            <p className="text-xs text-destructive">{requiredMsg}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t('create.basicInfo.referenceHint')}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel label={t('create.basicInfo.responseDeadline')} required />
          <DatePicker
            value={values.responseDeadline}
            onChange={(date) => onChange({ responseDeadline: date })}
            placeholder="mm/dd/yyyy"
            minDate={minDate}
            editable
          />
          {errors.responseDeadline && <p className="text-xs text-destructive">{requiredMsg}</p>}
        </div>

        {/* Row 2 — project (multiselect) / need by */}
        <div className="flex flex-col gap-1.5" data-testid="rfq-project-select">
          <FieldLabel label={t('create.basicInfo.project')} required />
          <SelectDropdown
            selected={values.projectIds}
            onSelectedChange={
              projectLocked ? undefined : (selected) => onChange({ projectIds: selected })
            }
            options={projectOptions}
            placeholder={t('create.basicInfo.projectPlaceholder')}
            className={projectLocked ? 'pointer-events-none opacity-60' : undefined}
            emptyMessage={t('create.basicInfo.noProjects')}
          />
          {errors.projectIds ? (
            <p className="text-xs text-destructive">{requiredMsg}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t('create.basicInfo.projectHint')}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel label={t('create.basicInfo.needBy')} optional={t('create.optional')} />
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <DatePicker
                value={values.needByDate}
                onChange={(date) => onChange({ needByDate: date })}
                placeholder="mm/dd/yyyy"
                minDate={minDate}
                editable
              />
            </div>
            {/* Input's own wrapper is w-full, so size the time field from outside —
                a className here only reaches the inner <input>. */}
            <div className="w-36 shrink-0">
              <Input
                type="time"
                value={values.needByTime}
                onChange={(e) => onChange({ needByTime: e.target.value })}
                aria-label={t('create.basicInfo.needByTime')}
                data-testid="rfq-need-by-time"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t('create.basicInfo.needByHint')}</p>
        </div>

        {/* Row 3 — where the materials go (pick-up location vs delivery
            location, mutually exclusive) / order flags */}
        {values.isPickUp ? (
          <div className="flex flex-col gap-1.5">
            <FieldLabel label={t('create.basicInfo.pickUpLocation')} required />
            <Input
              value={values.pickUpLocation}
              onChange={(e) => onChange({ pickUpLocation: e.target.value })}
              placeholder={t('create.basicInfo.pickUpLocationPlaceholder')}
              data-testid="rfq-pickup-location"
            />
            {errors.pickUpLocation && <p className="text-xs text-destructive">{requiredMsg}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5" data-testid="rfq-delivery-location">
            <FieldLabel label={t('create.basicInfo.deliveryLocation')} required />
            <SelectDropdown
              value={values.deliveryLocationId}
              onChange={(locationId) => onChange({ deliveryLocationId: locationId })}
              options={locationOptions}
              placeholder={t('create.basicInfo.deliveryLocationPlaceholder')}
              emptyMessage={
                primaryProjectId
                  ? t('create.basicInfo.noDeliveryLocations')
                  : t('create.basicInfo.selectProjectFirst')
              }
            />
            {errors.deliveryLocationId ? (
              <p className="text-xs text-destructive">{requiredMsg}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('create.basicInfo.deliveryLocationHint')}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1">
            <Checkbox
              checked={values.isPickUp}
              onChange={(checked) => onChange({ isPickUp: checked })}
              label={t('create.basicInfo.pickUpOrder')}
            />
            <p className="text-xs text-muted-foreground pl-7">
              {t('create.basicInfo.pickUpOrderHint')}
            </p>
          </div>
          <Checkbox
            checked={values.holdForRelease}
            onChange={(checked) => onChange({ holdForRelease: checked })}
            label={t('create.basicInfo.holdForRelease')}
          />
        </div>

        {/* Shown only for hold-for-release (design annotation). */}
        {values.holdForRelease && (
          <div className="flex flex-col gap-1.5" data-testid="rfq-earliest-date">
            <FieldLabel label={t('create.basicInfo.earliestDeliveryDate')} required />
            <DatePicker
              value={values.earliestDeliveryDate}
              onChange={(date) => onChange({ earliestDeliveryDate: date })}
              placeholder="mm/dd/yyyy"
              minDate={minDate}
              editable
            />
            {errors.earliestDeliveryDate && (
              <p className="text-xs text-destructive">{requiredMsg}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
