import type { CompanyResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { FormField, Input } from '@forethread/ui-components';
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
  isEditing?: boolean;
  formData?: Record<string, string>;
  onFieldChange?: (key: string, value: string) => void;
}

function maskValue(value: string): string {
  return value.replace(/\S/g, '#');
}

function InfoItem({
  icon,
  label,
  value,
  masked,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  masked?: boolean;
}) {
  const display = value ? (masked ? maskValue(value) : value) : '—';
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2 text-sm text-foreground">
        <span className="text-foreground shrink-0">{icon}</span>
        <span>{display}</span>
      </div>
    </div>
  );
}

export function OverviewTab({ company, isEditing, formData, onFieldChange }: OverviewTabProps) {
  const { t } = useTranslation('company');

  return (
    <div className="space-y-8">
      {/* Legal information */}
      <section>
        <h3 className="text-base font-semibold text-foreground mb-4">{t('legalInfo')}</h3>
        {isEditing && formData && onFieldChange ? (
          <>
            <div className="grid grid-cols-4 gap-6">
              <FormField label={t('overviewLabels.legalName')}>
                <Input
                  leftIcon={<LegalNameIcon className="w-5 h-5" />}
                  value={formData.legalName}
                  onChange={(e) => onFieldChange('legalName', e.target.value)}
                />
              </FormField>
              <FormField label={t('overviewLabels.tradeName')}>
                <Input
                  leftIcon={<TradeNameIcon className="w-5 h-5" />}
                  value={formData.tradeName}
                  onChange={(e) => onFieldChange('tradeName', e.target.value)}
                />
              </FormField>
              <FormField label={t('overviewLabels.abn')}>
                <Input leftIcon={<AbnIcon className="w-5 h-5" />} value={formData.abn} readOnly />
              </FormField>
              <FormField label={t('overviewLabels.taxCode')}>
                <Input
                  leftIcon={<TaxIcon className="w-5 h-5" />}
                  value={formData.taxCode}
                  readOnly
                />
              </FormField>
            </div>
            <div className="mt-4">
              <FormField label={t('overviewLabels.location')}>
                <Input
                  leftIcon={<LocationIcon className="w-5 h-5" />}
                  value={formData.legalAddress}
                  onChange={(e) => onFieldChange('legalAddress', e.target.value)}
                />
              </FormField>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-6">
              <InfoItem
                icon={<LegalNameIcon className="w-4 h-4" />}
                label={t('overviewLabels.legalName')}
                value={company.legalName}
              />
              <InfoItem
                icon={<TradeNameIcon className="w-4 h-4" />}
                label={t('overviewLabels.tradeName')}
                value={company.tradeName}
              />
              <InfoItem
                icon={<AbnIcon className="w-4 h-4" />}
                label={t('overviewLabels.abn')}
                value={company.abn}
                masked
              />
              <InfoItem
                icon={<TaxIcon className="w-4 h-4" />}
                label={t('overviewLabels.taxCode')}
                value={company.taxCode}
              />
            </div>
            <div className="mt-4">
              <InfoItem
                icon={<LocationIcon className="w-4 h-4" />}
                label={t('overviewLabels.location')}
                value={company.legalAddress}
              />
            </div>
          </>
        )}
      </section>

      <hr className="border-border" />

      {/* Contact information */}
      <section>
        <h3 className="text-base font-semibold text-foreground mb-4">{t('contactInfo')}</h3>
        {isEditing && formData && onFieldChange ? (
          <div className="grid grid-cols-3 gap-6">
            <FormField label={t('overviewLabels.email')}>
              <Input
                type="email"
                leftIcon={<EnvelopeIcon className="w-5 h-5" />}
                value={formData.contactEmail}
                onChange={(e) => onFieldChange('contactEmail', e.target.value)}
              />
            </FormField>
            <FormField label={t('overviewLabels.phoneNumber')}>
              <Input
                type="tel"
                leftIcon={<PhoneIcon className="w-5 h-5" />}
                value={formData.contactPhone}
                onChange={(e) => onFieldChange('contactPhone', e.target.value)}
              />
            </FormField>
            <FormField label={t('overviewLabels.website')}>
              <Input
                leftIcon={<WebIcon className="w-5 h-5" />}
                value={formData.website}
                onChange={(e) => onFieldChange('website', e.target.value)}
              />
            </FormField>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            <InfoItem
              icon={<EnvelopeIcon className="w-4 h-4" />}
              label={t('overviewLabels.email')}
              value={company.contactEmail}
            />
            <InfoItem
              icon={<PhoneIcon className="w-4 h-4" />}
              label={t('overviewLabels.phoneNumber')}
              value={company.contactPhone}
            />
            <InfoItem
              icon={<WebIcon className="w-4 h-4" />}
              label={t('overviewLabels.website')}
              value={company.website}
            />
          </div>
        )}
      </section>
    </div>
  );
}
