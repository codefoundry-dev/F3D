import { useTranslation } from '@forethread/i18n';
import { GridModal, Button, Input, FormField, Alert } from '@forethread/ui-components';
import DepartmentIcon from '@forethread/ui-components/assets/icons/department.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit-without-line.svg?react';
import { useState } from 'react';

import { useUpdateCompany } from '@/features/companies/services/companies.service';

import { useUsersStore } from '../../state/users.store';

export function EditCompanyModal() {
  const { t } = useTranslation(['users', 'common']);
  const { editCompanyId, editCompanyName, closeEditCompanyModal } = useUsersStore();
  const updateMutation = useUpdateCompany();
  const [companyName, setCompanyName] = useState(editCompanyName ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !editCompanyId) return;

    updateMutation.mutate(
      { id: editCompanyId, dto: { legalName: companyName.trim() } },
      { onSuccess: () => closeEditCompanyModal() },
    );
  };

  return (
    <GridModal
      onClose={closeEditCompanyModal}
      icon={<EditIcon className="size-6 text-gray-700" />}
      title={t('editCompanyModal.title')}
      description={t('editCompanyModal.subtitle')}
      onSubmit={handleSubmit}
      actions={
        <>
          <Button
            type="submit"
            size="lg"
            isLoading={updateMutation.isPending}
            disabled={!companyName.trim()}
            className="w-full"
          >
            {updateMutation.isPending
              ? t('editCompanyModal.submitting')
              : t('editCompanyModal.submitChanges')}
          </Button>
          <Button
            variant="outline"
            size="lg"
            type="button"
            onClick={closeEditCompanyModal}
            className="w-full"
          >
            {t('common:cancel')}
          </Button>
        </>
      }
    >
      <FormField label={t('editCompanyModal.companyName')} labelSize="lg">
        <Input
          type="text"
          inputSize="lg"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder={t('editCompanyModal.companyNamePlaceholder')}
          leftIcon={<DepartmentIcon className="w-5 h-5" />}
        />
      </FormField>

      {updateMutation.isError && (
        <Alert variant="destructive">
          {(updateMutation.error as { response?: { data?: { error?: string } } })?.response?.data
            ?.error ?? t('editCompanyModal.updateError')}
        </Alert>
      )}
    </GridModal>
  );
}
