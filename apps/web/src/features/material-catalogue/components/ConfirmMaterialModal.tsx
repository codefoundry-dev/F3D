import { useTranslation } from '@forethread/i18n';
import { Button, IconBadge, Modal } from '@forethread/ui-components';

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

function FolderIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <path d="M4 5h5l2 2.5h9a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <path d="M4 5h5l2 2.5h9a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
      <path d="M12 11v4M10 13h4" />
    </svg>
  );
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
      icon: <FolderIcon />,
      title: t('confirm.archive.title'),
      body: t('confirm.archive.body'),
      confirm: t('confirm.archive.confirm'),
      variant: 'primary' as const,
    },
    restore: {
      icon: <RestoreIcon />,
      title: t('confirm.restore.title'),
      body: t('confirm.restore.body'),
      confirm: t('confirm.restore.confirm'),
      variant: 'primary' as const,
    },
    delete: {
      icon: <TrashIcon />,
      title: t('confirm.delete.title'),
      body: t('confirm.delete.body'),
      confirm: t('confirm.delete.confirm'),
      variant: 'destructive' as const,
    },
  }[action];

  return (
    <Modal onClose={onClose} maxWidth="max-w-[480px]">
      <div
        className="px-8 py-8 flex flex-col items-center text-center"
        data-testid="confirm-material-modal"
      >
        <IconBadge icon={config.icon} />
        <h2 className="mt-4 text-xl font-semibold text-foreground">{title ?? config.title}</h2>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{body ?? config.body}</p>

        <div className="mt-6 w-full flex flex-col items-center gap-2">
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
        </div>
      </div>
    </Modal>
  );
}
