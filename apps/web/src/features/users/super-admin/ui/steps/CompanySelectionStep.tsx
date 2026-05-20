import { useTranslation } from '@forethread/i18n';
import { CompanyType } from '@forethread/shared-types/client';
import { Button, IconBadge, CustomDropdown, RadioGroup } from '@forethread/ui-components';
import DepartmentIcon from '@forethread/ui-components/assets/icons/department.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import PlusInCircleIcon from '@forethread/ui-components/assets/icons/plus-in-circle.svg?react';
import { useMemo, useState } from 'react';

import { useCompanies } from '@/features/companies/services/companies.service';

interface CompanySelectionStepProps {
  companyType: CompanyType | null;
  companyId: string | null;
  onCompanyTypeChange: (type: CompanyType) => void;
  onCompanyChange: (companyId: string, companyName: string) => void;
  onContinue: () => void;
  onCancel: () => void;
  onAddCompany: () => void;
}

export function CompanySelectionStep({
  companyType,
  companyId,
  onCompanyTypeChange,
  onCompanyChange,
  onContinue,
  onCancel,
  onAddCompany,
}: CompanySelectionStepProps) {
  const { t } = useTranslation(['users', 'common']);
  const [localCompanyId, setLocalCompanyId] = useState(companyId ?? '');

  const { data: companiesData } = useCompanies(
    companyType ? { type: companyType, limit: 100 } : undefined,
  );

  const companyOptions = useMemo(
    () => companiesData?.items.map((c) => ({ value: c.id, label: c.legalName })) ?? [],
    [companiesData],
  );

  const companyTypeOptions = useMemo(
    () =>
      (['CONTRACTOR', 'VENDOR'] as const).map((type) => ({
        value: type,
        label: String(t(`createUserPage.${type.toLowerCase() as 'contractor' | 'vendor'}`)),
      })),
    [t],
  );

  const handleCompanyTypeChange = (type: CompanyType) => {
    onCompanyTypeChange(type);
    setLocalCompanyId('');
  };

  const handleCompanySelect = (value: string) => {
    setLocalCompanyId(value);
    const company = companiesData?.items.find((c) => c.id === value);
    if (company) {
      onCompanyChange(company.id, company.legalName);
    }
  };

  const actionLabel =
    companyType === CompanyType.VENDOR
      ? t('createUserPage.addVendorCompany')
      : t('createUserPage.addContractorCompany');

  return (
    <div className="flex flex-col items-center text-center">
      <IconBadge icon={<NewUserIcon className="w-6 h-6 text-foreground" />} className="bg-muted" />

      <h2 className="text-lg font-medium leading-6 text-foreground mt-4">
        {t('createUserPage.title')}
      </h2>
      <p className="text-sm text-muted-foreground mt-1">{t('createUserPage.subtitle')}</p>

      {/* Company Type Radio */}
      <div className="w-full mt-6 text-left">
        <label className="block text-sm font-medium text-card-foreground mb-2">
          {t('createUserPage.companyTypeLabel')}
        </label>
        <RadioGroup
          name="companyType"
          options={companyTypeOptions}
          value={companyType}
          onChange={(v) => handleCompanyTypeChange(v as CompanyType)}
        />
      </div>

      {/* Company Dropdown */}
      {companyType && (
        <div className="w-full mt-4 text-left">
          <label className="block text-sm font-medium text-card-foreground mb-2">
            {t('createUserPage.company')}
          </label>
          <CustomDropdown
            options={companyOptions}
            value={localCompanyId}
            onChange={handleCompanySelect}
            placeholder={t('createUserPage.selectCompany')}
            leftIcon={<DepartmentIcon className="w-5 h-5" />}
            searchable
            searchPlaceholder={t('createUserPage.searchCompany')}
            grouped
            actionItem={{
              label: actionLabel,
              icon: <PlusInCircleIcon className="w-5 h-5" />,
              onClick: onAddCompany,
            }}
          />
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 w-full mt-6">
        <Button variant="outline" type="button" onClick={onCancel} className="flex-1">
          {t('createUserPage.cancel')}
        </Button>
        <Button
          type="button"
          onClick={onContinue}
          disabled={!companyType || !localCompanyId}
          className="flex-1"
        >
          {t('createUserPage.continue')}
        </Button>
      </div>
    </div>
  );
}
