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
    <span className="flex items-center gap-1 text-sm text-[#1B1D22]">
      {children}
      <span className="text-[#6D7588]">*</span>
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
  const base = 'flex-1 rounded-lg px-4 py-3 text-sm transition-colors';
  return (
    <div className="flex gap-4">
      <button
        type="button"
        onClick={() => onChange('STANDARD')}
        aria-pressed={value === 'STANDARD'}
        className={`${base} ${
          value === 'STANDARD'
            ? 'bg-[#1B1D22] font-medium text-white'
            : 'border border-[#E8EAED] bg-white text-[#1B1D22]'
        }`}
      >
        {t('materialDetails.priorityStandard')}
      </button>
      <button
        type="button"
        onClick={() => onChange('HIGH')}
        aria-pressed={value === 'HIGH'}
        className={`${base} ${
          value === 'HIGH'
            ? 'bg-[#1B1D22] font-medium text-white'
            : 'border border-[#E8EAED] bg-white text-[#1B1D22]'
        }`}
      >
        {t('materialDetails.priorityHigh')}
      </button>
    </div>
  );
}

/**
 * Step 2 — "Material Details" (Figma 2002:176 frame 14:331). One detail card per
 * selected line: a material summary header (#F4F4F6), then Quantity Needed*, CC
 * Team Members, the Standard/High priority toggle, Need-by date* + Delivery
 * Time*, Delivery Address*, Instructions and Internal notes.
 */
export function StepMaterialDetails({
  lines,
  errors,
  locationOptions,
  onPatchLine,
}: StepMaterialDetailsProps) {
  const { t } = useTranslation('materialRequests');

  return (
    <div className="flex flex-col gap-6 px-4 py-6" data-testid="mr-details-step">
      {lines.map((line, index) => {
        const lineErrors = errors[line.key] ?? {};
        return (
          <section key={line.key} className="flex flex-col gap-6">
            {lines.length > 1 && (
              <p className="text-xs font-medium uppercase tracking-wide text-[#6D7588]">
                {t('materialDetails.itemOf', { current: index + 1, total: lines.length })}
              </p>
            )}

            {/* Material summary card */}
            <div className="flex gap-4 rounded-lg bg-[#F4F4F6] p-4">
              <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md bg-[#999FAD] p-3 text-center text-xs text-white">
                {t('materialDetails.materialImage')}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div>
                  <p className="truncate text-lg text-[#1B1D22]">{line.materialName}</p>
                  {line.description && (
                    <p className="truncate text-sm text-[#525866]">{line.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <p className="text-xs text-[#525866]">{t('materialDetails.unit')}</p>
                    <p className="text-sm text-[#1B1D22]">{line.unit}</p>
                  </div>
                  {typeof line.maxAvailable === 'number' && (
                    <div className="flex-1">
                      <p className="text-xs text-[#525866]">{t('materialDetails.stock')}</p>
                      <p className="text-sm text-[#1B1D22]">
                        {t('materialDetails.stockAvailable', { count: line.maxAvailable })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

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
                <p className="text-xs text-[#525866]">
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
              <span className="flex items-center gap-1 text-sm text-[#1B1D22]">
                {t('materialDetails.ccTeam')}
                <span className="text-[#6D7588]">({t('materialDetails.optional')})</span>
              </span>
              <Input
                value={line.ccTeamMembers ?? ''}
                onChange={(e) => onPatchLine(line.key, { ccTeamMembers: e.target.value })}
                placeholder={t('materialDetails.ccTeamPlaceholder')}
                aria-label={t('materialDetails.ccTeam')}
              />
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-2">
              <span className="text-sm text-[#1B1D22]">{t('materialDetails.priority')}</span>
              <PriorityToggle
                value={line.priority}
                onChange={(priority) => onPatchLine(line.key, { priority })}
              />
            </div>

            {/* Need by date + Delivery time */}
            <div className="flex gap-4">
              <div className="flex flex-1 flex-col gap-2" data-testid={`mr-needby-${line.key}`}>
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
              <div className="flex w-[42%] flex-col gap-2">
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
            </div>

            {/* Delivery Address */}
            <div className="flex flex-col gap-2" data-testid={`mr-address-${line.key}`}>
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
            <div className="flex flex-col gap-2.5">
              <span className="text-sm text-[#1B1D22]">{t('materialDetails.instructions')}</span>
              <Textarea
                value={line.instructions ?? ''}
                onChange={(e) => onPatchLine(line.key, { instructions: e.target.value })}
                placeholder={t('materialDetails.instructionsPlaceholder')}
                rows={3}
                aria-label={t('materialDetails.instructions')}
              />
            </div>

            {/* Internal notes */}
            <div className="flex flex-col gap-2.5">
              <span className="flex items-center gap-1 text-sm text-[#1B1D22]">
                {t('materialDetails.internalNotes')}
                <span className="text-[#6D7588]">({t('materialDetails.optional')})</span>
              </span>
              <Textarea
                value={line.internalNotes ?? ''}
                onChange={(e) => onPatchLine(line.key, { internalNotes: e.target.value })}
                placeholder={t('materialDetails.internalNotesPlaceholder')}
                rows={3}
                aria-label={t('materialDetails.internalNotes')}
              />
            </div>

            {index < lines.length - 1 && <hr className="border-[#E8EAED]" />}
          </section>
        );
      })}
    </div>
  );
}
