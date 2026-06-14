import type { PoChangedFields } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Textarea } from '@forethread/ui-components';
import type { UseFormRegister } from 'react-hook-form';

import type { FormValues } from '../schemas/create-po.schema';

import { PoChangeDiff } from './PoChangeDiff';

interface PoChangeReviewStepProps {
  changedFields: PoChangedFields;
  register: UseFormRegister<FormValues>;
  locationOptions: { value: string; label: string }[];
  onEditStep?: (step: number) => void;
}

/**
 * FLOW 3 — Step 3 of the Change Purchase Order wizard (SPEC FLOW 3 / pc3).
 *
 * Replaces the standard {@link PoReviewStep} when the wizard runs in change
 * mode. Renders the computed diff ("Suggested changes" + "Line item changes")
 * via the shared {@link PoChangeDiff}, with "Edit" links back to step 1/2, and a
 * "Note (optional)" textarea bound to `message`. The footer "Submit PO changes"
 * button lives in {@link CreatePoWizard}.
 */
export function PoChangeReviewStep({
  changedFields,
  register,
  locationOptions,
  onEditStep,
}: PoChangeReviewStepProps) {
  const { t } = useTranslation('purchaseOrders');

  const hasChanges =
    Object.keys(changedFields.fields ?? {}).length > 0 ||
    (changedFields.lineItems ?? []).length > 0;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Step 3 of 3 {t('change.step3Title')}</h2>
        <p className="text-sm text-muted-foreground">{t('change.step3Subtitle')}</p>
      </div>

      <div className="bg-card rounded-lg border border-border p-6">
        {hasChanges ? (
          <PoChangeDiff
            changedFields={changedFields}
            locationOptions={locationOptions}
            onEditFields={onEditStep ? () => onEditStep(1) : undefined}
            onEditLineItems={onEditStep ? () => onEditStep(2) : undefined}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t('change.noChanges')}</p>
        )}
      </div>

      {/* Note (optional) */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="font-semibold mb-2">
          {t('change.noteLabel')}{' '}
          <span className="text-muted-foreground font-normal text-sm">
            ({t('change.noteOptional')})
          </span>
        </h3>
        <Textarea {...register('message')} rows={4} placeholder={t('change.notePlaceholder')} />
      </div>
    </section>
  );
}
