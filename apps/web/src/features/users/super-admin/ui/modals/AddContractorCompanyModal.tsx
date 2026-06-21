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
  Alert,
} from '@forethread/ui-components';
import DepartmentIcon from '@forethread/ui-components/assets/icons/department.svg?react';
import { useState } from 'react';

import { useCreateCompany } from '@/features/companies/services/companies.service';

interface AddContractorCompanyModalProps {
  onClose: () => void;
  onSuccess: (company: CompanyResponse) => void;
}

export function AddContractorCompanyModal({ onClose, onSuccess }: AddContractorCompanyModalProps) {
  const { t } = useTranslation(['users', 'common']);
  const createMutation = useCreateCompany();
  const [companyName, setCompanyName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    createMutation.mutate(
      { type: CompanyType.CONTRACTOR, legalName: companyName.trim() },
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
        title={t('addCompanyModal.createContractorTitle')}
        subtitle={t('addCompanyModal.createContractorSubtitle')}
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
