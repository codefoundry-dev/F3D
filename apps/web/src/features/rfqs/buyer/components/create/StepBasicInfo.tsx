import type { ProjectListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Checkbox, DatePicker, Input, SelectDropdown } from '@forethread/ui-components';

import type { WizardBasicInfo, WizardFieldErrors } from './wizard-types';

export interface DeliveryLocationOption {
  id: string;
  label: string;
  projectId: string;
}

interface StepBasicInfoProps {
  values: WizardBasicInfo;
  onChange: (patch: Partial<WizardBasicInfo>) => void;
  projects: ProjectListItem[];
  /** Union of DELIVERY locations across the selected projects. */
  locationOptions: DeliveryLocationOption[];
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
 * Step 1 — "Fulfill information" card (Figma 5.05, frame "1.3. RFQ manually - 1").
 * Two-column field grid; pick-up swaps the delivery-location field for a
 * pick-up location, and "Hold for release" reveals the earliest allowed
 * delivery date (both per the design annotations).
 */
export function StepBasicInfo({
  values,
  onChange,
  projects,
  locationOptions,
  errors,
  projectLocked = false,
}: StepBasicInfoProps) {
  const { t } = useTranslation('rfqs');

  const projectOptions = projects.map((p) => ({ value: p.id, label: p.name }));
  const locationSelectOptions = locationOptions.map((l) => ({ value: l.id, label: l.label }));

  const requiredMsg = t('create.errors.required');

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
        {/* Row 1 — document name / response deadline */}
        <div className="flex flex-col gap-1.5">
          <FieldLabel label={t('create.basicInfo.documentName')} required />
          <Input
            value={values.documentName}
            onChange={(e) => onChange({ documentName: e.target.value })}
            placeholder={t('create.basicInfo.documentNamePlaceholder')}
            data-testid="rfq-document-name"
          />
          {errors.documentName ? (
            <p className="text-xs text-destructive">{requiredMsg}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t('create.basicInfo.documentNameHint')}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel label={t('create.basicInfo.responseDeadline')} required />
          <DatePicker
            value={values.responseDeadline}
            onChange={(date) => onChange({ responseDeadline: date })}
            placeholder="mm/dd/yyyy"
            editable
          />
          {errors.responseDeadline && <p className="text-xs text-destructive">{requiredMsg}</p>}
        </div>

        {/* Row 2 — project (multiselect) / delivery or pick-up location */}
        <div className="flex flex-col gap-1.5" data-testid="rfq-project-select">
          <FieldLabel label={t('create.basicInfo.project')} required />
          <SelectDropdown
            selected={values.projectIds}
            onSelectedChange={
              projectLocked
                ? undefined
                : (selected) => {
                    // Keep only locations that still belong to a selected project.
                    onChange({ projectIds: selected });
                  }
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
              selected={values.deliveryLocationIds}
              onSelectedChange={(selected) => onChange({ deliveryLocationIds: selected })}
              options={locationSelectOptions}
              placeholder={t('create.basicInfo.deliveryLocationPlaceholder')}
              emptyMessage={t('create.basicInfo.noLocations')}
            />
            {errors.deliveryLocationIds && <p className="text-xs text-destructive">{requiredMsg}</p>}
          </div>
        )}

        {/* Row 3 — need by / order flags */}
        <div className="flex flex-col gap-1.5">
          <FieldLabel label={t('create.basicInfo.needBy')} optional={t('create.optional')} />
          <DatePicker
            value={values.needByDate}
            onChange={(date) => onChange({ needByDate: date })}
            placeholder="mm/dd/yyyy"
            editable
          />
        </div>

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
              editable
            />
            {errors.earliestDeliveryDate && <p className="text-xs text-destructive">{requiredMsg}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
