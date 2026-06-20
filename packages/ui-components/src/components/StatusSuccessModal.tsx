import { type ReactNode, useEffect, useState } from 'react';

import CheckCircleIcon from '../assets/icons/checkcircle-icon.svg?react';

import { Button } from './Button';
import { IconBadge } from './IconBadge';
import { Modal, ModalBody, ModalCloseButton } from './Modal';

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
  /** Custom icon to replace the default check circle */
  icon?: ReactNode;
  /** Custom className for IconBadge wrapper */
  iconBadgeClassName?: string;
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
  iconBadgeClassName,
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
    <Modal onClose={onClose} maxWidth={maxWidth}>
      <ModalBody>
        <div className="flex flex-col items-center text-center">
          {/* Header with close button */}
          <div className="w-full flex justify-between items-start">
            <div className="flex-1" />
            <IconBadge
              icon={icon ?? <CheckCircleIcon className="w-6 h-6 text-foreground" />}
              className={iconBadgeClassName}
            />
            <div className="flex-1 flex justify-end">
              <ModalCloseButton onClose={onClose} />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-semibold leading-[140%] text-foreground mt-4">{title}</h2>

          {/* Subtitle */}
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}

          {/* Description */}
          <div className="w-full mt-4 text-sm text-muted-foreground">{description}</div>

          {/* Optional note */}
          {note && <p className="text-sm text-muted-foreground mt-2">{note}</p>}

          {/* Back button */}
          <Button onClick={onClose} className="w-full mt-5">
            {buttonLabel}
          </Button>

          {/* Countdown */}
          <p className="text-xs text-muted-foreground mt-3">{redirectLabel(countdown)}</p>
        </div>
      </ModalBody>
    </Modal>
  );
}
