import type { CompanyResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { CompanyType } from '@forethread/shared-types/client';
import {
  Modal,
  ModalGridBackground,
  ModalGridHeader,
  REGISTRATION_MODAL_CARD_CLASS,
  Button,
  Input,
  FormField,
  CustomDropdown,
  Alert,
} from '@forethread/ui-components';
import DepartmentIcon from '@forethread/ui-components/assets/icons/department.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import WrenchIcon from '@forethread/ui-components/assets/icons/wrench.svg?react';
import { useState } from 'react';

import { useCreateCompany } from '@/features/companies/services/companies.service';

/** DS field-sized (48px / Corner-m) trigger so the dropdown matches the lg inputs. */
const DS_DROPDOWN_TRIGGER =
  'h-12 rounded-[14px] border-[#E8EAED] bg-white py-0 text-[16px] text-gray-900';

const SPECIALISATION_OPTIONS = [
  { value: 'Civil', label: 'Civil' },
  { value: 'Infrastructure', label: 'Infrastructure' },
  { value: 'Materials', label: 'Materials' },
  { value: 'Equipment', label: 'Equipment' },
];

interface AddVendorCompanyModalProps {
  onClose: () => void;
  onSuccess: (company: CompanyResponse) => void;
}

export function AddVendorCompanyModal({ onClose, onSuccess }: AddVendorCompanyModalProps) {
  const { t } = useTranslation(['users', 'common']);
  const createMutation = useCreateCompany();
  const [companyName, setCompanyName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [specialisation, setSpecialisation] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    createMutation.mutate(
      {
        type: CompanyType.VENDOR,
        legalName: companyName.trim(),
        contactEmail: contactEmail.trim() || undefined,
        specialisations: specialisation ? [specialisation] : undefined,
      },
      {
        onSuccess: (data) => {
          onSuccess(data);
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      onClose={onClose}
      decoration={<ModalGridBackground />}
      cardClassName={REGISTRATION_MODAL_CARD_CLASS}
    >
      <ModalGridHeader
        icon={<DepartmentIcon className="size-6 text-gray-700" />}
        title={t('addCompanyModal.createVendorTitle')}
        subtitle={t('addCompanyModal.createVendorSubtitle')}
      />

      <form
        onSubmit={handleSubmit}
        className="relative flex w-full flex-col gap-10 text-left"
        noValidate
      >
        <div className="flex w-full flex-col gap-6">
          <FormField label={t('addCompanyModal.companyName')} labelSize="lg">
            <Input
              type="text"
              inputSize="lg"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={t('addCompanyModal.companyNamePlaceholder')}
              leftIcon={<DepartmentIcon className="size-5" />}
            />
          </FormField>

          <FormField label={t('addCompanyModal.companyEmail')} labelSize="lg" optional>
            <Input
              type="email"
              inputSize="lg"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder={t('addCompanyModal.companyEmailPlaceholder')}
              leftIcon={<EnvelopeIcon className="size-5" />}
            />
          </FormField>

          <FormField label={t('addCompanyModal.specialisation')} labelSize="lg" optional>
            <CustomDropdown
              options={SPECIALISATION_OPTIONS}
              value={specialisation}
              onChange={setSpecialisation}
              placeholder={t('addCompanyModal.selectSpecialisation')}
              leftIcon={<WrenchIcon className="size-5" />}
              triggerClassName={DS_DROPDOWN_TRIGGER}
            />
          </FormField>

          {createMutation.isError && (
            <Alert variant="destructive">
              {(createMutation.error as { response?: { data?: { error?: string } } })?.response
                ?.data?.error ?? t('addCompanyModal.createError')}
            </Alert>
          )}
        </div>

        <div className="flex w-full flex-col gap-3">
          <Button
            type="submit"
            size="lg"
            isLoading={createMutation.isPending}
            disabled={!companyName.trim()}
            className="w-full"
          >
            {createMutation.isPending ? t('addCompanyModal.creating') : t('addCompanyModal.create')}
          </Button>
          <Button variant="outline" size="lg" type="button" onClick={onClose} className="w-full">
            {t('common:cancel')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
