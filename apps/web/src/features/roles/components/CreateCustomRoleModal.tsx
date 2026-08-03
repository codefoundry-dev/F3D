import { useTranslation } from '@forethread/i18n';
import { Button, GridModal, Input, notificationService } from '@forethread/ui-components';
import ShieldIcon from '@forethread/ui-components/assets/icons/shield-icon.svg?react';
import { useState } from 'react';

import { useCreateCustomRole } from '../services/roles.service';

interface CreateCustomRoleModalProps {
  onClose: () => void;
  /** Called with the new role id after a successful create. */
  onCreated: (id: string) => void;
}

/**
 * Name/description step of creating a custom role (FOR-252). Permissions are
 * granted afterwards on the edit page the caller navigates to via `onCreated`.
 */
export function CreateCustomRoleModal({ onClose, onCreated }: CreateCustomRoleModalProps) {
  const { t } = useTranslation('roles');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const createMutation = useCreateCustomRole();
  const trimmedName = name.trim();

  const handleCreate = async () => {
    try {
      const created = await createMutation.mutateAsync({
        name: trimmedName,
        description: description.trim() || undefined,
      });
      notificationService.success(t('custom.created'));
      onCreated(created.id);
    } catch {
      notificationService.error(t('custom.createError'));
    }
  };

  return (
    <GridModal
      onClose={onClose}
      icon={<ShieldIcon className="size-6 text-gray-700" />}
      title={t('custom.createTitle')}
      description={t('custom.createDescription')}
      actions={
        <>
          <Button
            variant="primary"
            size="lg"
            onClick={() => void handleCreate()}
            disabled={!trimmedName}
            isLoading={createMutation.isPending}
            className="w-full"
            data-testid="custom-role-create-confirm"
          >
            {t('custom.createConfirm')}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onClose}
            disabled={createMutation.isPending}
            className="w-full"
          >
            {t('cancel')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <label
            htmlFor="new-custom-role-name"
            className="mb-1 block text-xs font-medium text-gray-900"
          >
            {t('custom.nameLabel')}
          </label>
          <Input
            id="new-custom-role-name"
            value={name}
            placeholder={t('custom.namePlaceholder')}
            onChange={(e) => setName(e.target.value)}
            data-testid="custom-role-create-name"
          />
        </div>
        <div>
          <label
            htmlFor="new-custom-role-description"
            className="mb-1 block text-xs font-medium text-gray-900"
          >
            {t('custom.descriptionLabel')}
          </label>
          <Input
            id="new-custom-role-description"
            value={description}
            placeholder={t('custom.descriptionPlaceholder')}
            onChange={(e) => setDescription(e.target.value)}
            data-testid="custom-role-create-description"
          />
        </div>
      </div>
    </GridModal>
  );
}
