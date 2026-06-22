import { type ReactNode, useEffect, useState } from 'react';

import CheckCircleIcon from '../assets/icons/checkcircle-icon.svg?react';

import { Button } from './Button';
import { GridModal } from './GridModal';

export interface StatusSuccessModalProps {
  onClose: () => void;
  title: string;
  subtitle?: string;
  description: ReactNode;
  note?: string;
  buttonLabel: string;
  redirectLabel: (seconds: number) => string;
  countdownSeconds?: number;
  maxWidth?: string;
  /** Custom icon to replace the default check circle (rendered in the DS badge). */
  icon?: ReactNode;
}

export function StatusSuccessModal({
  onClose,
  title,
  subtitle,
  description,
  note,
  buttonLabel,
  redirectLabel,
  countdownSeconds = 3,
  maxWidth,
  icon,
}: StatusSuccessModalProps) {
  const [countdown, setCountdown] = useState(countdownSeconds);

  useEffect(() => {
    if (countdown <= 0) {
      onClose();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, onClose]);

  return (
    <GridModal
      onClose={onClose}
      maxWidth={maxWidth}
      icon={icon ?? <CheckCircleIcon className="size-6 text-gray-700" />}
      title={title}
      description={subtitle}
      bodyClassName="gap-2 text-center text-sm text-muted-foreground"
      actions={
        <>
          <Button onClick={onClose} size="lg" className="w-full">
            {buttonLabel}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{redirectLabel(countdown)}</p>
        </>
      }
    >
      <div className="w-full">{description}</div>
      {note && <p>{note}</p>}
    </GridModal>
  );
}
