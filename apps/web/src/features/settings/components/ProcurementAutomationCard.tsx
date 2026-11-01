import { useTranslation } from '@forethread/i18n';
import { toast, ToggleSwitch } from '@forethread/ui-components';

import { useCompany, useUpdateCompany } from '@/features/companies/services/companies.service';

interface ProcurementAutomationCardProps {
  companyId: string;
}

/**
 * Company Admin setting (FOR-396): approving a material request also creates
 * its draft RFQ, so buyers skip the manual "Convert to RFQ" step.
 */
export function ProcurementAutomationCard({ companyId }: ProcurementAutomationCardProps) {
  const { t } = useTranslation('company');
  const { data: company } = useCompany(companyId);
  const update = useUpdateCompany();
  const enabled = company?.autoConvertApprovedMrToRfq ?? false;

  const handleChange = (next: boolean) =>
    update.mutate(
      { id: companyId, dto: { autoConvertApprovedMrToRfq: next } },
      { onSuccess: () => toast.success(t('automationCard.saved')) },
    );

  return (
    <section
      aria-labelledby="procurement-automation-card-title"
      className="flex max-w-2xl items-center gap-4 rounded-[18px] border border-gray-100 bg-[#F9F9FA] p-4 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]"
    >
      <div className="min-w-0 flex-1">
        <h2 id="procurement-automation-card-title" className="text-sm font-semibold text-gray-900">
          {t('automationCard.title')}
        </h2>
        <p className="text-xs text-gray-500">{t('automationCard.mrToRfq')}</p>
      </div>
      <ToggleSwitch
        checked={enabled}
        onChange={handleChange}
        disabled={!company || update.isPending}
        aria-label={t('automationCard.mrToRfq')}
      />
    </section>
  );
}
