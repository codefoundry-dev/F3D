import { useTranslation } from '@forethread/i18n';
import { DatePicker, Input, Textarea, Select } from '@forethread/ui-components';

import {
  type MrWizardLine,
  type MrDetailsErrors,
  type MrPriorityToggle,
} from '../wizard/wizard-types';

export interface DeliveryLocationOption {
  id: string;
  label: string;
}

export interface StepMaterialDetailsProps {
  lines: MrWizardLine[];
  errors: MrDetailsErrors;
  locationOptions: DeliveryLocationOption[];
  onPatchLine: (key: string, patch: Partial<MrWizardLine>) => void;
}

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 text-sm font-medium text-foreground">
      {children}
      <span className="text-muted-foreground">*</span>
    </span>
  );
}

function OptionalLabel({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('materialRequests');
  return (
    <span className="flex items-center gap-1 text-sm font-medium text-foreground">
      {children}
      <span className="text-muted-foreground">({t('materialDetails.optional')})</span>
    </span>
  );
}

function PriorityToggle({
  value,
  onChange,
}: {
  value: MrPriorityToggle;
  onChange: (v: MrPriorityToggle) => void;
}) {
  const { t } = useTranslation('materialRequests');
  const base = 'flex-1 rounded-lg px-4 py-2.5 text-sm transition-colors';
  const active = 'bg-foreground font-medium text-background';
  const inactive = 'border border-border bg-card text-foreground hover:bg-accent/50';
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => onChange('STANDARD')}
        aria-pressed={value === 'STANDARD'}
        className={`${base} ${value === 'STANDARD' ? active : inactive}`}
      >
        {t('materialDetails.priorityStandard')}
      </button>
      <button
        type="button"
        onClick={() => onChange('HIGH')}
        aria-pressed={value === 'HIGH'}
        className={`${base} ${value === 'HIGH' ? active : inactive}`}
      >
        {t('materialDetails.priorityHigh')}
      </button>
    </div>
  );
}

/**
 * Step 2 — "Material Details" (Figma 2002:176 frame 14:331). One detail block
 * per selected line: a material summary header, then Quantity Needed*, CC Team
 * Members, the Standard/High priority toggle, Need-by date* + Delivery Time*,
 * Delivery Address*, Instructions and Internal notes. Lays the fields out in a
 * responsive two-column grid on desktop. Renders inside the wizard's
 * design-system card.
 */
export function StepMaterialDetails({
  lines,
  errors,
  locationOptions,
  onPatchLine,
}: StepMaterialDetailsProps) {
  const { t } = useTranslation('materialRequests');

  return (
    <div className="flex flex-col gap-8 p-5 sm:p-6" data-testid="mr-details-step">
      {lines.map((line, index) => {
        const lineErrors = errors[line.key] ?? {};
        return (
          <section key={line.key} className="flex flex-col gap-6">
            {lines.length > 1 && (
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('materialDetails.itemOf', { current: index + 1, total: lines.length })}
              </p>
            )}

            {/* Material summary card */}
            <div className="flex gap-4 rounded-lg border border-border bg-muted/40 p-4">
              <span className="flex size-20 shrink-0 items-center justify-center rounded-md bg-muted p-3 text-center text-[11px] text-muted-foreground">
                {t('materialDetails.materialImage')}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div>
                  <p className="truncate text-base font-medium text-foreground">
                    {line.materialName}
                  </p>
                  {line.description && (
                    <p className="truncate text-sm text-muted-foreground">{line.description}</p>
                  )}
                </div>
                <div className="flex gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('materialDetails.unit')}</p>
                    <p className="text-sm text-foreground">{line.unit}</p>
                  </div>
                  {typeof line.maxAvailable === 'number' && (
                    <div>
                      <p className="text-xs text-muted-foreground">{t('materialDetails.stock')}</p>
                      <p className="text-sm text-foreground">
                        {t('materialDetails.stockAvailable', { count: line.maxAvailable })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Fields */}
            <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2">
              {/* Quantity Needed */}
              <div className="flex flex-col gap-2">
                <RequiredLabel>{t('materialDetails.quantityNeeded')}</RequiredLabel>
                <Input
                  type="number"
                  min={0}
                  value={line.quantity > 0 ? String(line.quantity) : ''}
                  onChange={(e) => onPatchLine(line.key, { quantity: Number(e.target.value) })}
                  placeholder={t('materialDetails.quantityPlaceholder')}
                  aria-label={t('materialDetails.quantityNeeded')}
                  data-testid={`mr-qty-${line.key}`}
                />
                {typeof line.maxAvailable === 'number' && (
                  <p className="text-xs text-muted-foreground">
                    {t('materialDetails.maxAvailable', {
                      count: line.maxAvailable,
                      unit: line.unit.toLowerCase(),
                    })}
                  </p>
                )}
                {lineErrors.quantity === 'required' && (
                  <p className="text-xs text-destructive">{t('materialDetails.quantityNeeded')}</p>
                )}
                {lineErrors.quantity === 'exceedsStock' && (
                  <p className="text-xs text-destructive">
                    {t('materialDetails.maxAvailable', {
                      count: line.maxAvailable ?? 0,
                      unit: line.unit.toLowerCase(),
                    })}
                  </p>
                )}
              </div>

              {/* CC Team Members */}
              <div className="flex flex-col gap-2">
                <OptionalLabel>{t('materialDetails.ccTeam')}</OptionalLabel>
                <Input
                  value={line.ccTeamMembers ?? ''}
                  onChange={(e) => onPatchLine(line.key, { ccTeamMembers: e.target.value })}
                  placeholder={t('materialDetails.ccTeamPlaceholder')}
                  aria-label={t('materialDetails.ccTeam')}
                />
              </div>

              {/* Priority */}
              <div className="flex flex-col gap-2 sm:col-span-2">
                <span className="text-sm font-medium text-foreground">
                  {t('materialDetails.priority')}
                </span>
                <PriorityToggle
                  value={line.priority}
                  onChange={(priority) => onPatchLine(line.key, { priority })}
                />
              </div>

              {/* Need by date */}
              <div className="flex flex-col gap-2" data-testid={`mr-needby-${line.key}`}>
                <RequiredLabel>{t('materialDetails.needByDate')}</RequiredLabel>
                <DatePicker
                  value={line.expectedDeliveryDate ?? ''}
                  onChange={(date) => onPatchLine(line.key, { expectedDeliveryDate: date })}
                  placeholder={t('materialDetails.pickDate')}
                  editable
                />
                {lineErrors.expectedDeliveryDate && (
                  <p className="text-xs text-destructive">{t('materialDetails.needByDate')}</p>
                )}
              </div>

              {/* Delivery time */}
              <div className="flex flex-col gap-2">
                <RequiredLabel>{t('materialDetails.deliveryTime')}</RequiredLabel>
                <Input
                  type="time"
                  value={line.deliveryTime ?? ''}
                  onChange={(e) => onPatchLine(line.key, { deliveryTime: e.target.value })}
                  aria-label={t('materialDetails.deliveryTime')}
                  data-testid={`mr-time-${line.key}`}
                />
                {lineErrors.deliveryTime && (
                  <p className="text-xs text-destructive">{t('materialDetails.deliveryTime')}</p>
                )}
              </div>

              {/* Delivery Address */}
              <div
                className="flex flex-col gap-2 sm:col-span-2"
                data-testid={`mr-address-${line.key}`}
              >
                <RequiredLabel>{t('materialDetails.deliveryAddress')}</RequiredLabel>
                <Select
                  value={line.deliveryLocationId ?? ''}
                  onChange={(e) => onPatchLine(line.key, { deliveryLocationId: e.target.value })}
                  aria-label={t('materialDetails.deliveryAddress')}
                >
                  <option value="">{t('materialDetails.selectAddress')}</option>
                  {locationOptions.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.label}
                    </option>
                  ))}
                </Select>
                {lineErrors.deliveryLocationId && (
                  <p className="text-xs text-destructive">{t('materialDetails.deliveryAddress')}</p>
                )}
              </div>

              {/* Instructions */}
              <div className="flex flex-col gap-2 sm:col-span-2">
                <span className="text-sm font-medium text-foreground">
                  {t('materialDetails.instructions')}
                </span>
                <Textarea
                  value={line.instructions ?? ''}
                  onChange={(e) => onPatchLine(line.key, { instructions: e.target.value })}
                  placeholder={t('materialDetails.instructionsPlaceholder')}
                  rows={3}
                  aria-label={t('materialDetails.instructions')}
                />
              </div>

              {/* Internal notes */}
              <div className="flex flex-col gap-2 sm:col-span-2">
                <OptionalLabel>{t('materialDetails.internalNotes')}</OptionalLabel>
                <Textarea
                  value={line.internalNotes ?? ''}
                  onChange={(e) => onPatchLine(line.key, { internalNotes: e.target.value })}
                  placeholder={t('materialDetails.internalNotesPlaceholder')}
                  rows={3}
                  aria-label={t('materialDetails.internalNotes')}
                />
              </div>
            </div>

            {index < lines.length - 1 && <hr className="border-border" />}
          </section>
        );
      })}
    </div>
  );
}
