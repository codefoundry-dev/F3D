import { useTranslation } from '@forethread/i18n';
import { CompanyType } from '@forethread/shared-types/client';
import { Button, ModalGridHeader, CustomDropdown, RadioGroup } from '@forethread/ui-components';
import DepartmentIcon from '@forethread/ui-components/assets/icons/department.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import PlusInCircleIcon from '@forethread/ui-components/assets/icons/plus-in-circle.svg?react';
import { useMemo, useState } from 'react';

import { useCompanies } from '@/features/companies/services/companies.service';

/** DS field-sized (48px / Corner-m) trigger so the dropdown matches the lg inputs. */
const DS_DROPDOWN_TRIGGER =
  'h-12 rounded-[14px] border-[#E8EAED] bg-white py-0 text-[16px] text-gray-900';

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
    <>
      <ModalGridHeader
        icon={<NewUserIcon className="size-6 text-gray-700" />}
        title={t('createUserPage.title')}
        subtitle={t('createUserPage.subtitle')}
      />

      <div className="relative flex w-full flex-col gap-6 text-left">
        {/* User type */}
        <div className="flex flex-col gap-2">
          <span className="px-2 text-[16px] font-medium leading-[1.4] tracking-[0.3px] text-gray-800">
            {t('createUserPage.companyTypeLabel')}
          </span>
          <RadioGroup
            name="companyType"
            options={companyTypeOptions}
            value={companyType}
            onChange={(v) => handleCompanyTypeChange(v as CompanyType)}
            className="px-2"
          />
        </div>

        {/* Company */}
        {companyType && (
          <div className="flex flex-col gap-2">
            <span className="px-2 text-[16px] font-medium leading-[1.4] tracking-[0.3px] text-gray-800">
              {t('createUserPage.company')}
            </span>
            <CustomDropdown
              options={companyOptions}
              value={localCompanyId}
              onChange={handleCompanySelect}
              placeholder={t('createUserPage.selectCompany')}
              leftIcon={<DepartmentIcon className="size-5" />}
              triggerClassName={DS_DROPDOWN_TRIGGER}
              searchable
              searchPlaceholder={t('createUserPage.searchCompany')}
              grouped
              actionItem={{
                label: actionLabel,
                icon: <PlusInCircleIcon className="size-5" />,
                onClick: onAddCompany,
              }}
            />
          </div>
        )}
      </div>

      <div className="relative flex w-full flex-col gap-3">
        <Button
          type="button"
          size="lg"
          onClick={onContinue}
          disabled={!companyType || !localCompanyId}
          className="w-full"
        >
          {t('createUserPage.continue')}
        </Button>
        <Button variant="outline" size="lg" type="button" onClick={onCancel} className="w-full">
          {t('createUserPage.cancel')}
        </Button>
      </div>
    </>
  );
}
