import { useTranslation } from '@forethread/i18n';
import { PO_TERMS_MAX_LENGTH } from '@forethread/shared-types/client';
import { Button, Textarea, toast } from '@forethread/ui-components';
import { useEffect, useState } from 'react';

import { useCompany, useUpdateCompany } from '@/features/companies/services/companies.service';

interface PoTermsCardProps {
  companyId: string;
}

/**
 * Company Admin setting (FOR-398): the default general terms & conditions every
 * new PO copies. Each PO keeps its own snapshot, so saving here never rewrites
 * POs that already exist.
 */
export function PoTermsCard({ companyId }: PoTermsCardProps) {
  const { t } = useTranslation('company');
  const { data: company } = useCompany(companyId);
  const update = useUpdateCompany();
  const saved = company?.poTermsAndConditions ?? '';
  const [draft, setDraft] = useState(saved);

  // Re-seed the editor whenever the stored terms load or change.
  useEffect(() => setDraft(saved), [saved]);

  const handleSave = () =>
    update.mutate(
      { id: companyId, dto: { poTermsAndConditions: draft } },
      { onSuccess: () => toast.success(t('poTermsCard.saved')) },
    );

  return (
    <section
      aria-labelledby="po-terms-card-title"
      className="flex max-w-2xl flex-col gap-3 rounded-[18px] border border-gray-100 bg-[#F9F9FA] p-4 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]"
    >
      <div>
        <h2 id="po-terms-card-title" className="text-sm font-semibold text-gray-900">
          {t('poTermsCard.title')}
        </h2>
        <p className="text-xs text-gray-500">{t('poTermsCard.description')}</p>
      </div>
      <Textarea
        aria-label={t('poTermsCard.label')}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={8}
        maxLength={PO_TERMS_MAX_LENGTH}
        placeholder={t('poTermsCard.placeholder')}
        disabled={!company}
      />
      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          onClick={handleSave}
          isLoading={update.isPending}
          disabled={!company || draft === saved}
        >
          {t('poTermsCard.save')}
        </Button>
      </div>
    </section>
  );
}
