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
  Checkbox,
  Alert,
} from '@forethread/ui-components';
import BriefcaseIcon from '@forethread/ui-components/assets/icons/briefcase.svg?react';
import DepartmentIcon from '@forethread/ui-components/assets/icons/department.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import { useMemo, useState } from 'react';

import { useCompanies, useCreateCompany } from '@/features/companies/services/companies.service';

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
  const [specialisations, setSpecialisations] = useState<string[]>([]);
  const [selectedContractorIds, setSelectedContractorIds] = useState<string[]>([]);

  const { data: contractorsData } = useCompanies({ type: CompanyType.CONTRACTOR, limit: 100 });
  const contractorOptions = useMemo(
    () => contractorsData?.items.map((c) => ({ value: c.id, label: c.legalName })) ?? [],
    [contractorsData],
  );

  const toggleContractor = (id: string) => {
    setSelectedContractorIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    createMutation.mutate(
      {
        type: CompanyType.VENDOR,
        legalName: companyName.trim(),
        contactEmail: contactEmail.trim() || undefined,
        specialisations: specialisations.length > 0 ? specialisations : undefined,
        assignedContractorIds: selectedContractorIds.length > 0 ? selectedContractorIds : undefined,
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
            <IconBadge
              icon={<BriefcaseIcon className="w-6 h-6 text-foreground" />}
              className="bg-muted"
            />
            <div className="flex-1 flex justify-end">
              <ModalCloseButton onClose={onClose} />
            </div>
          </div>

          <h2 className="text-lg font-semibold text-foreground mt-4">
            {t('addCompanyModal.createVendorTitle')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('addCompanyModal.createVendorSubtitle')}
          </p>

          <form onSubmit={handleSubmit} className="w-full mt-5 space-y-4 text-left" noValidate>
            <FormField label={t('addCompanyModal.companyName')} required>
              <Input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={t('addCompanyModal.companyNamePlaceholder')}
                leftIcon={<DepartmentIcon className="w-5 h-5" />}
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
              <div className="flex flex-wrap gap-3">
                {SPECIALISATION_OPTIONS.map((opt) => (
                  <Checkbox
                    key={opt.value}
                    checked={specialisations.includes(opt.value)}
                    onChange={(checked) =>
                      setSpecialisations((prev) =>
                        checked ? [...prev, opt.value] : prev.filter((v) => v !== opt.value),
                      )
                    }
                    label={opt.label}
                  />
                ))}
              </div>
            </FormField>

            <FormField label={t('addCompanyModal.assignContractors')} required>
              <div className="space-y-2 max-h-40 overflow-auto rounded-lg border border-input bg-muted p-2">
                {contractorOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-2 py-1">
                    {t('addCompanyModal.noContractors')}
                  </p>
                ) : (
                  contractorOptions.map((opt) => (
                    <div key={opt.value} className="px-2 py-1.5 rounded-lg hover:bg-accent">
                      <Checkbox
                        checked={selectedContractorIds.includes(opt.value)}
                        onChange={() => toggleContractor(opt.value)}
                        label={opt.label}
                      />
                    </div>
                  ))
                )}
              </div>
            </FormField>

            {createMutation.isError && (
              <Alert variant="destructive">
                {(createMutation.error as { response?: { data?: { error?: string } } })?.response
                  ?.data?.error ?? t('addCompanyModal.createError')}
              </Alert>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" type="button" onClick={onClose} className="flex-1">
                {t('common:cancel')}
              </Button>
              <Button
                type="submit"
                isLoading={createMutation.isPending}
                disabled={!companyName.trim() || selectedContractorIds.length === 0}
                className="flex-1"
              >
                {createMutation.isPending
                  ? t('addCompanyModal.creating')
                  : t('addCompanyModal.create')}
              </Button>
            </div>
          </form>
        </div>
      </ModalBody>
    </Modal>
  );
}
