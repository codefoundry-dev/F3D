import { useTranslation } from '@forethread/i18n';
import { Button } from '@forethread/ui-components';
import ImageIcon from '@forethread/ui-components/assets/icons/image.svg?react';

import { useCompanyLogo } from '../hooks/useCompanyLogo';

interface CompanyLogoCardProps {
  companyId: string;
}

/**
 * Settings card for the company logo (FOR-389). Lets every role holding
 * `company.updateLogo` — including Procurement Officers, who can't open the
 * admin-only Company Details page — set the logo that brands PO and invoice PDFs.
 */
export function CompanyLogoCard({ companyId }: CompanyLogoCardProps) {
  const { t } = useTranslation('company');
  const { logoUrl, inputRef, isPending, handleLogoChange, openFilePicker } =
    useCompanyLogo(companyId);

  return (
    <section
      aria-labelledby="company-logo-card-title"
      className="flex max-w-2xl items-center gap-4 rounded-[18px] border border-gray-100 bg-[#F9F9FA] p-4 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)] max-md:flex-col max-md:items-stretch"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.svg"
        className="hidden"
        onChange={handleLogoChange}
        data-testid="company-logo-input"
      />

      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span className="flex h-12 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-gray-100 bg-white">
          {logoUrl ? (
            <img src={logoUrl} alt={t('logoCard.title')} className="size-full object-contain" />
          ) : (
            <ImageIcon className="size-5 text-gray-400" />
          )}
        </span>
        <div className="min-w-0">
          <h2 id="company-logo-card-title" className="text-sm font-semibold text-gray-900">
            {t('logoCard.title')}
          </h2>
          <p className="text-xs text-gray-500">{t('logoPdfHint')}</p>
          <p className="text-xs text-gray-400">{t('logoCard.formats')}</p>
        </div>
      </div>

      <Button variant="secondary" onClick={openFilePicker} isLoading={isPending}>
        {logoUrl ? t('logoCard.change') : t('logoCard.upload')}
      </Button>
    </section>
  );
}
