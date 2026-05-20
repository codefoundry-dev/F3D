import { useTranslation } from '@forethread/i18n';
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  Button,
  IconBadge,
  Input,
  FormField,
  Alert,
} from '@forethread/ui-components';
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
    <Modal onClose={closeEditCompanyModal}>
      <ModalBody>
        <div className="flex flex-col items-center text-center">
          <div className="w-full flex justify-between items-start">
            <div className="flex-1" />
            <IconBadge
              icon={<EditIcon className="w-6 h-6 text-foreground" />}
              className="bg-muted"
            />
            <div className="flex-1 flex justify-end">
              <ModalCloseButton onClose={closeEditCompanyModal} />
            </div>
          </div>

          <h2 className="text-lg font-semibold text-foreground mt-4">
            {t('editCompanyModal.title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{t('editCompanyModal.subtitle')}</p>

          <form onSubmit={handleSubmit} className="w-full mt-5 space-y-4 text-left" noValidate>
            <FormField label={t('editCompanyModal.companyName')} required>
              <Input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                leftIcon={<DepartmentIcon className="w-5 h-5" />}
              />
            </FormField>

            {updateMutation.isError && (
              <Alert variant="destructive">
                {(updateMutation.error as { response?: { data?: { error?: string } } })?.response
                  ?.data?.error ?? t('editCompanyModal.updateError')}
              </Alert>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <Button
                type="submit"
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
                type="button"
                onClick={closeEditCompanyModal}
                className="w-full"
              >
                {t('common:cancel')}
              </Button>
            </div>
          </form>
        </div>
      </ModalBody>
    </Modal>
  );
}
