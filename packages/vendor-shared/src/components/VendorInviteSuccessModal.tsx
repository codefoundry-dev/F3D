import { useTranslation } from '@forethread/i18n';
import { StatusSuccessModal } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';

interface VendorInviteSuccessModalProps {
  email: string;
  onClose: () => void;
  alreadyExisted?: boolean;
  /** Override labels for reuse in different contexts (e.g. vendor user invite) */
  labels?: {
    title?: string;
    subtitle?: string;
    info?: string;
    expiry?: string;
    backButton?: string;
    redirecting?: (seconds: number) => string;
  };
}

export function VendorInviteSuccessModal({
  email,
  onClose,
  labels,
}: VendorInviteSuccessModalProps) {
  const { t } = useTranslation('vendors');

  const title = labels?.title ?? t('inviteSuccess.title');
  const subtitle = labels?.subtitle ?? t('inviteSuccess.subtitle');
  const info =
    labels?.info ?? t('inviteSuccess.info', { email, interpolation: { escapeValue: false } });
  const expiry = labels?.expiry ?? t('inviteSuccess.expiry');
  const backButton = labels?.backButton ?? t('inviteSuccess.backToVendors');

  const description = (
    <div className="w-full rounded-xl bg-success/10 border border-success/20 px-4 py-3 text-left">
      <p className="text-sm text-success" dangerouslySetInnerHTML={{ __html: info }} />
    </div>
  );

  return (
    <StatusSuccessModal
      onClose={onClose}
      maxWidth="max-w-[560px]"
      title={title}
      subtitle={subtitle}
      description={description}
      note={expiry}
      buttonLabel={backButton}
      redirectLabel={
        labels?.redirecting ?? ((seconds) => t('inviteSuccess.redirecting', { seconds }))
      }
      icon={<CheckCircleIcon className="w-6 h-6 text-success" />}
      iconBadgeClassName="bg-success/10"
    />
  );
}
