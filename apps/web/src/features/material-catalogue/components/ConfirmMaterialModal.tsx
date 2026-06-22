import { useTranslation } from '@forethread/i18n';
import { Button, GridModal } from '@forethread/ui-components';
import CircleReloadIcon from '@forethread/ui-components/assets/icons/circle-reload.svg?react';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import MaterialCatalogueIcon from '@forethread/ui-components/assets/icons/material-catalogue.svg?react';

export type ConfirmMaterialAction = 'archive' | 'delete' | 'restore';

export interface ConfirmMaterialModalProps {
  action: ConfirmMaterialAction;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** Optional copy overrides so the same modal can confirm e.g. deleting a list. */
  title?: string;
  body?: string;
  confirmLabel?: string;
}

/**
 * Archive / Delete / Restore confirmation for a material (US 4.01, screens 14 &
 * 15). Centered icon badge, title, body, a full-width primary button (red for
 * delete) and a plain "Cancel" text button — matching the design exactly.
 */
export function ConfirmMaterialModal({
  action,
  isLoading,
  onConfirm,
  onClose,
  title,
  body,
  confirmLabel,
}: ConfirmMaterialModalProps) {
  const { t } = useTranslation(['materialCatalogue']);

  const config = {
    archive: {
      icon: <MaterialCatalogueIcon className="size-6 text-gray-700" />,
      title: t('confirm.archive.title'),
      body: t('confirm.archive.body'),
      confirm: t('confirm.archive.confirm'),
      variant: 'primary' as const,
    },
    restore: {
      icon: <CircleReloadIcon className="size-6 text-gray-700" />,
      title: t('confirm.restore.title'),
      body: t('confirm.restore.body'),
      confirm: t('confirm.restore.confirm'),
      variant: 'primary' as const,
    },
    delete: {
      icon: <DeleteIcon className="size-6 text-destructive" />,
      title: t('confirm.delete.title'),
      body: t('confirm.delete.body'),
      confirm: t('confirm.delete.confirm'),
      variant: 'destructive' as const,
    },
  }[action];

  return (
    <GridModal
      onClose={onClose}
      icon={config.icon}
      title={<span data-testid="confirm-material-modal">{title ?? config.title}</span>}
      description={body ?? config.body}
      actions={
        <>
          <Button
            variant={config.variant}
            className="w-full"
            isLoading={isLoading}
            onClick={onConfirm}
            data-testid="confirm-material-action"
          >
            {confirmLabel ?? config.confirm}
          </Button>
          <Button
            variant="ghost"
            className="w-full font-semibold"
            type="button"
            onClick={onClose}
            disabled={isLoading}
          >
            {t('confirm.cancel')}
          </Button>
        </>
      }
    />
  );
}
