import type { CompanyResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import AbnIcon from '@forethread/ui-components/assets/icons/abn.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import LegalNameIcon from '@forethread/ui-components/assets/icons/legal-name.svg?react';
import LocationIcon from '@forethread/ui-components/assets/icons/location.svg?react';
import PhoneIcon from '@forethread/ui-components/assets/icons/phone.svg?react';
import TaxIcon from '@forethread/ui-components/assets/icons/tax.svg?react';
import TradeNameIcon from '@forethread/ui-components/assets/icons/trade-name.svg?react';
import WebIcon from '@forethread/ui-components/assets/icons/web.svg?react';

interface OverviewTabProps {
  company: CompanyResponse;
}

/**
 * Bordered info card (Figma node 4384:91620): a small disabled-grey label over
 * an icon + value row inside a white rounded-10 card.
 */
function InfoCard({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-[10px] border border-[#e8eaed] bg-white p-[13px] shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)] ${className ?? ''}`}
    >
      <p className="truncate text-sm font-medium leading-[1.4] tracking-[0.3px] text-[#6d7588]">
        {label}
      </p>
      <div className="flex h-7 items-center gap-2">
        <span className="shrink-0 text-gray-900">{icon}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-[1.4] tracking-[0.3px] text-gray-900">
          {value?.trim() ? value : '—'}
        </span>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[15px] font-semibold leading-[1.4] tracking-[0.3px] text-gray-900">
      {children}
    </h3>
  );
}

/**
 * Company "Company overview" tab (US 1.09) — Legal + Contact information shown
 * as bordered info cards. The 18px field icon sits left of each value.
 */
export function OverviewTab({ company }: OverviewTabProps) {
  const { t } = useTranslation('company');

  return (
    <div className="flex flex-col gap-6">
      {/* Legal information */}
      <section className="flex flex-col gap-3.5">
        <SectionTitle>{t('legalInfo')}</SectionTitle>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard
            icon={<LegalNameIcon className="size-[18px]" />}
            label={t('overviewLabels.legalName')}
            value={company.legalName}
          />
          <InfoCard
            icon={<TradeNameIcon className="size-[18px]" />}
            label={t('overviewLabels.tradeName')}
            value={company.tradeName}
          />
          <InfoCard
            icon={<AbnIcon className="size-[18px]" />}
            label={t('overviewLabels.abn')}
            value={company.abn}
          />
          <InfoCard
            icon={<TaxIcon className="size-[18px]" />}
            label={t('overviewLabels.taxCode')}
            value={company.taxCode}
          />
          <InfoCard
            className="lg:col-span-4 sm:col-span-2"
            icon={<LocationIcon className="size-[18px]" />}
            label={t('overviewLabels.location')}
            value={company.legalAddress}
          />
        </div>
      </section>

      {/* Contact information */}
      <section className="flex flex-col gap-3.5">
        <SectionTitle>{t('contactInfo')}</SectionTitle>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard
            icon={<EnvelopeIcon className="size-[18px]" />}
            label={t('overviewLabels.email')}
            value={company.contactEmail}
          />
          <InfoCard
            icon={<PhoneIcon className="size-[18px]" />}
            label={t('overviewLabels.phoneNumber')}
            value={company.contactPhone}
          />
          <InfoCard
            className="lg:col-span-2 sm:col-span-2"
            icon={<WebIcon className="size-[18px]" />}
            label={t('overviewLabels.website')}
            value={company.website}
          />
        </div>
      </section>
    </div>
  );
}
