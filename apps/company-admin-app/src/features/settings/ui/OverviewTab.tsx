import type { CompanyResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import LegalNameIcon from '@forethread/ui-components/assets/icons/legal-name.svg?react';
import LocationIcon from '@forethread/ui-components/assets/icons/location.svg?react';
import MyAbnIcon from '@forethread/ui-components/assets/icons/my-abn.svg?react';
import PhoneIcon from '@forethread/ui-components/assets/icons/phone.svg?react';
import TaxIcon from '@forethread/ui-components/assets/icons/tax.svg?react';
import TradeNameIcon from '@forethread/ui-components/assets/icons/trade-name.svg?react';
import WebIcon from '@forethread/ui-components/assets/icons/web.svg?react';

interface OverviewTabProps {
  company: CompanyResponse;
}

function InfoItem({
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
    <div className={className}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2 text-sm text-foreground">
        <span className="text-foreground shrink-0">{icon}</span>
        <span>{value ?? '—'}</span>
      </div>
    </div>
  );
}

export function OverviewTab({ company }: OverviewTabProps) {
  const { t } = useTranslation('company');

  return (
    <div className="space-y-8">
      {/* Legal information */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-4">{t('legalInfo')}</h3>
        <div className="grid grid-cols-4 gap-6">
          <InfoItem
            icon={<LegalNameIcon className="w-4 h-4" />}
            label={t('legalName')}
            value={company.legalName}
          />
          <InfoItem
            icon={<TradeNameIcon className="w-4 h-4" />}
            label={t('tradeName')}
            value={company.tradeName}
          />
          <InfoItem icon={<MyAbnIcon className="w-4 h-4" />} label={t('abn')} value={company.abn} />
          <InfoItem
            icon={<TaxIcon className="w-4 h-4" />}
            label={t('taxCode')}
            value={company.taxCode}
          />
        </div>
        <div className="mt-4">
          <InfoItem
            icon={<LocationIcon className="w-4 h-4" />}
            label={t('location')}
            value={company.legalAddress}
          />
        </div>
      </section>

      {/* Contact information */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-4">{t('contactInfo')}</h3>
        <div className="grid grid-cols-3 gap-6">
          <InfoItem
            icon={<EnvelopeIcon className="w-4 h-4" />}
            label={t('contactEmail')}
            value={company.contactEmail}
          />
          <InfoItem
            icon={<PhoneIcon className="w-4 h-4" />}
            label={t('contactPhone')}
            value={company.contactPhone}
          />
          <InfoItem
            icon={<WebIcon className="w-4 h-4" />}
            label={t('website')}
            value={company.website}
          />
        </div>
      </section>
    </div>
  );
}
