import { useEffect, useRef, useState, useCallback } from 'react';

import ClockIcon from '../assets/icons/clock-icon.svg?react';
import EnvelopeIcon from '../assets/icons/envelope-simple.svg?react';
import InfoIcon from '../assets/icons/info.svg?react';
import ShieldIcon from '../assets/icons/shield-icon.svg?react';
import { cn } from '../utils/cn';

import { Alert } from './Alert';
import { AuthLayout } from './AuthLayout';
import { Badge } from './Badge';
import { Button } from './Button';
import { Text } from './Text';

const OTP_LENGTH = 6;

export interface TwoFactorCardProps {
  title: string;
  description: string;
  email: string;
  digitLabel: (index: number) => string;
  expiresInText: string;
  expiredText: string;
  verifyLabel: string;
  didntReceiveText: string;
  resendTimerText: (time: string) => string;
  resendLabel: string;
  backLabel: string;
  errorMessage?: string;
  isPending: boolean;
  isError: boolean;
  secondsLeft: number;
  isResending?: boolean;
  isLocked?: boolean;
  lockedMessage?: string;
  contactSupportLabel?: string;
  onVerify: (otp: string) => void;
  onBackToLogin: () => void;
  onResend?: () => void;
  onContactSupport?: () => void;
}

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function ShieldBadge() {
  return (
    <Badge className="flex items-center justify-center w-12 h-12 rounded-[12px] bg-foreground/10 p-0">
      <ShieldIcon className="w-6 h-6 text-muted-foreground" />
    </Badge>
  );
}

function EmailBadge({ email }: { email: string }) {
  return (
    <div className="flex items-center justify-center gap-2 h-11 rounded-[10px] bg-badge-blue-text/[0.04] border border-badge-blue-text/20">
      <EnvelopeIcon className="flex-shrink-0 w-5 h-5 text-badge-blue-text" />
      <Text variant="body-14" as="span" className="text-badge-blue-text">
        {email}
      </Text>
    </div>
  );
}

export function TwoFactorCard({
  title,
  description,
  email,
  digitLabel,
  expiresInText,
  expiredText,
  verifyLabel,
  didntReceiveText,
  resendTimerText,
  resendLabel,
  backLabel,
  errorMessage,
  isPending,
  isError,
  secondsLeft,
  isResending,
  isLocked,
  lockedMessage,
  contactSupportLabel,
  onVerify,
  onBackToLogin,
  onResend,
  onContactSupport,
}: TwoFactorCardProps) {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const isExpired = secondsLeft === 0 && !isLocked;

  useEffect(() => {
    if (!isExpired && !isLocked) {
      inputRefs.current[0]?.focus();
    }
  }, [isExpired, isLocked]);

  const handleSubmit = useCallback(() => {
    const otp = digits.join('');
    if (otp.length === OTP_LENGTH) {
      onVerify(otp);
    }
  }, [digits, onVerify]);

  const handleChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value)) return;

      const newDigits = [...digits];
      newDigits[index] = value.slice(-1);
      setDigits(newDigits);

      if (value && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits],
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      if (e.key === 'Enter') {
        handleSubmit();
      }
    },
    [digits, handleSubmit],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
      if (pasted.length === OTP_LENGTH) {
        const newDigits = pasted.split('');
        setDigits(newDigits);
        inputRefs.current[OTP_LENGTH - 1]?.focus();
        onVerify(pasted);
      }
    },
    [onVerify],
  );

  const isComplete = digits.every((d) => d !== '');

  if (isLocked) {
    return (
      <AuthLayout icon={<ShieldBadge />} title={title} description={description}>
        <div className="space-y-6">
          {lockedMessage && (
            <Alert variant="destructive" icon={<InfoIcon className="w-5 h-5" />}>
              {lockedMessage}
            </Alert>
          )}

          {contactSupportLabel && onContactSupport && (
            <div className="text-center">
              <button type="button" className="hover:underline" onClick={onContactSupport}>
                <Text variant="body-18" as="span">
                  {contactSupportLabel}
                </Text>
              </button>
            </div>
          )}
        </div>
      </AuthLayout>
    );
  }

  if (isExpired) {
    return (
      <AuthLayout icon={<ShieldBadge />} title={title} description={description}>
        <div className="space-y-6">
          <EmailBadge email={email} />

          <div className="flex items-center justify-center gap-1.5">
            <ClockIcon className="w-4 h-4 text-foreground" />
            <Text variant="body-16" as="span" className="text-foreground">
              {expiredText}
            </Text>
          </div>

          <Button size="lg" className="w-full" onClick={onResend} isLoading={isResending}>
            {resendLabel}
          </Button>

          <Button variant="outline" size="lg" className="w-full" onClick={onBackToLogin}>
            {backLabel}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={<ShieldBadge />} title={title} description={description}>
      <div className="space-y-6">
        <EmailBadge email={email} />

        <div className="flex gap-1 justify-center" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={isPending}
              className={cn(
                'w-14 h-14 text-center text-base font-normal leading-6 font-[Inter] transition-colors',
                'border-[0.8px] border-transparent bg-muted',
                'focus:outline-none focus:border-foreground/50 focus:bg-muted',
                'disabled:opacity-50',
                i === 0 && 'rounded-l-lg',
                i === OTP_LENGTH - 1 && 'rounded-r-lg',
                i > 0 && i < OTP_LENGTH - 1 && 'rounded-none',
              )}
              aria-label={digitLabel(i + 1)}
            />
          ))}
        </div>

        <div className="flex items-center justify-center gap-1.5">
          <ClockIcon className="w-4 h-4 text-foreground" />
          <Text variant="body-16" as="span" className="text-foreground">
            {expiresInText} {formatTime(secondsLeft)}
          </Text>
        </div>

        {isError && errorMessage && (
          <Alert variant="destructive" icon={<InfoIcon className="w-5 h-5" />}>
            {errorMessage}
          </Alert>
        )}

        <Button
          size="lg"
          className="w-full"
          onClick={handleSubmit}
          isLoading={isPending}
          disabled={!isComplete}
        >
          {verifyLabel}
        </Button>

        <div className="text-center">
          <Text variant="body-16" as="p" className="font-[Inter] font-normal leading-[140%]">
            {didntReceiveText} {resendTimerText(formatTime(secondsLeft))}
          </Text>
        </div>

        <Button variant="outline" size="lg" className="w-full" onClick={onBackToLogin}>
          {backLabel}
        </Button>
      </div>
    </AuthLayout>
  );
}
