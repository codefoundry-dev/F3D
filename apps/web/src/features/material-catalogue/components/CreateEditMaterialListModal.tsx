import { type MaterialListSummaryDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Button, Input, Modal, ModalBody, ModalIconHeader } from '@forethread/ui-components';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import { type FormEvent, useState } from 'react';

export interface CreateEditMaterialListModalProps {
  /** When provided, the modal edits this list; otherwise it creates a new one. */
  list?: Pick<MaterialListSummaryDto, 'id' | 'name' | 'description'> | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; description?: string }) => void;
}

/**
 * Create / edit a material list (US 4.03) — matches the Figma "Create new
 * Material list" modal: package icon, title, Name + Description fields, a
 * full-width dark primary action and a full-width outline Cancel.
 */
export function CreateEditMaterialListModal({
  list,
  isSubmitting,
  onClose,
  onSubmit,
}: CreateEditMaterialListModalProps) {
  const { t } = useTranslation(['materialCatalogue']);
  const isEdit = Boolean(list);

  const [name, setName] = useState(list?.name ?? '');
  const [description, setDescription] = useState(list?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('createListModal.nameRequired'));
      return;
    }
    onSubmit({ name: trimmed, description: description.trim() || undefined });
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <ModalBody>
        <ModalIconHeader
          icon={<PackageIcon className="w-6 h-6 text-foreground" />}
          title={
            <span className="text-lg font-semibold">
              {isEdit ? t('createListModal.editTitle') : t('createListModal.createTitle')}
            </span>
          }
          subtitle={
            <span className="text-sm text-muted-foreground">{t('createListModal.subtitle')}</span>
          }
          onClose={onClose}
          className="mb-6"
        />

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          data-testid="create-list-form"
          noValidate
        >
          <div className="space-y-1.5">
            <label htmlFor="material-list-name" className="text-sm font-medium text-foreground">
              {t('createListModal.nameLabel')}
            </label>
            <Input
              id="material-list-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t('createListModal.namePlaceholder')}
              data-testid="create-list-name"
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="material-list-description"
              className="text-sm font-medium text-foreground"
            >
              {t('createListModal.descriptionLabel')}
            </label>
            <Input
              id="material-list-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('createListModal.descriptionPlaceholder')}
              data-testid="create-list-description"
            />
          </div>

          <div className="space-y-2 pt-2">
            <Button
              type="submit"
              className="w-full"
              isLoading={isSubmitting}
              data-testid="create-list-submit"
            >
              {isEdit ? t('createListModal.save') : t('createListModal.create')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onClose}
              data-testid="create-list-cancel"
            >
              {t('createListModal.cancel')}
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
}
