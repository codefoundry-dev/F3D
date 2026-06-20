import type { CompanyResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { CompanyType } from '@forethread/shared-types/client';
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  Button,
  IconBadge,
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
    <Modal onClose={onClose}>
      <ModalBody>
        <div className="flex flex-col items-center text-center">
          <div className="w-full flex justify-between items-start">
            <div className="flex-1" />
            <IconBadge icon={<DepartmentIcon className="w-6 h-6 text-foreground" />} />
            <div className="flex-1 flex justify-end">
              <ModalCloseButton onClose={onClose} />
            </div>
          </div>

          <h2 className="text-2xl font-semibold leading-[140%] text-foreground mt-4">
            {t('addCompanyModal.createVendorTitle')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('addCompanyModal.createVendorSubtitle')}
          </p>

          <form onSubmit={handleSubmit} className="w-full mt-5 space-y-4 text-left" noValidate>
            <FormField label={t('addCompanyModal.companyName')}>
              <Input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={t('addCompanyModal.companyNamePlaceholder')}
              />
            </FormField>

            <FormField label={t('addCompanyModal.companyEmail')}>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder={t('addCompanyModal.companyEmailPlaceholder')}
                leftIcon={<EnvelopeIcon className="w-5 h-5" />}
              />
            </FormField>

            <FormField label={t('addCompanyModal.specialisation')}>
              <CustomDropdown
                options={SPECIALISATION_OPTIONS}
                value={specialisation}
                onChange={setSpecialisation}
                placeholder={t('addCompanyModal.selectSpecialisation')}
                leftIcon={<WrenchIcon className="w-5 h-5" />}
              />
            </FormField>

            {createMutation.isError && (
              <Alert variant="destructive">
                {(createMutation.error as { response?: { data?: { error?: string } } })?.response
                  ?.data?.error ?? t('addCompanyModal.createError')}
              </Alert>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <Button
                type="submit"
                isLoading={createMutation.isPending}
                disabled={!companyName.trim()}
                className="w-full"
              >
                {createMutation.isPending
                  ? t('addCompanyModal.creating')
                  : t('addCompanyModal.create')}
              </Button>
              <Button variant="outline" type="button" onClick={onClose} className="w-full">
                {t('common:cancel')}
              </Button>
            </div>
          </form>
        </div>
      </ModalBody>
    </Modal>
  );
}
