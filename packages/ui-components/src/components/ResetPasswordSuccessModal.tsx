import type { ReactNode } from 'react';

import { Alert } from './Alert';
import { StatusSuccessModal } from './StatusSuccessModal';

export interface ResetPasswordSuccessModalProps {
  onClose: () => void;
  title: string;
  subtitle: string;
  infoText: ReactNode;
  buttonLabel: string;
  redirectLabel: (seconds: number) => string;
  countdownSeconds?: number;
}

export function ResetPasswordSuccessModal({
  onClose,
  title,
  subtitle,
  infoText,
  buttonLabel,
  redirectLabel,
  countdownSeconds = 3,
}: ResetPasswordSuccessModalProps) {
  const description = (
    <div className="w-full">
      <Alert variant="success">{infoText}</Alert>
    </div>
  );

  return (
    <StatusSuccessModal
      onClose={onClose}
      maxWidth="max-w-[560px]"
      title={title}
      subtitle={subtitle}
      description={description}
      buttonLabel={buttonLabel}
      redirectLabel={redirectLabel}
      countdownSeconds={countdownSeconds}
    />
  );
}
