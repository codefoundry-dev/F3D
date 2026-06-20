import { useEffect, useRef, useState, useCallback } from 'react';

import ClockIcon from '../assets/icons/clock-icon.svg?react';
import EnvelopeIcon from '../assets/icons/envelope-simple.svg?react';
import InfoIcon from '../assets/icons/info.svg?react';
import ShieldIcon from '../assets/icons/shield-icon.svg?react';
import { cn } from '../utils/cn';

import { Alert } from './Alert';
import { AuthLayout } from './AuthLayout';
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
  /** Seconds to wait after arriving / each resend before "Resend" is offered again. */
  resendCooldownSeconds?: number;
  onVerify: (otp: string) => void;
  onBackToLogin: () => void;
  onResend?: () => void;
  onContactSupport?: () => void;
}

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const shieldIcon = <ShieldIcon className="w-6 h-6 text-muted-foreground" />;

function EmailBadge({ email }: { email: string }) {
  return (
    <div className="flex w-full items-center justify-center gap-2 h-11 rounded-[10px] bg-badge-blue-text/[0.04] border border-badge-blue-text/20">
      <EnvelopeIcon className="flex-shrink-0 w-[18px] h-[18px] text-badge-blue-text" />
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
  resendCooldownSeconds = 30,
  onVerify,
  onBackToLogin,
  onResend,
  onContactSupport,
}: TwoFactorCardProps) {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const isExpired = secondsLeft === 0 && !isLocked;

  // Resend cooldown (independent of the OTP-expiry countdown): the button is
  // offered once this hits zero, and restarts on each resend.
  const [resendCooldown, setResendCooldown] = useState(resendCooldownSeconds);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  useEffect(() => {
    if (!isExpired && !isLocked) {
      inputRefs.current[0]?.focus();
    }
  }, [isExpired, isLocked]);

  // Guard against double-submission: paste auto-submits AND the button/Enter
  // submit, so two verify calls could fire for one code — the second then races
  // the first and hits "No OTP found". Only allow one submit until it settles.
  const inFlightRef = useRef(false);
  useEffect(() => {
    if (!isPending) inFlightRef.current = false;
  }, [isPending]);

  const submit = useCallback(
    (code: string) => {
      if (code.length !== OTP_LENGTH || isPending || inFlightRef.current) return;
      inFlightRef.current = true;
      onVerify(code);
    },
    [isPending, onVerify],
  );

  const handleSubmit = useCallback(() => submit(digits.join('')), [submit, digits]);

  const handleResend = useCallback(() => {
    if (isResending) return;
    setResendCooldown(resendCooldownSeconds);
    onResend?.();
  }, [isResending, onResend, resendCooldownSeconds]);

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
        submit(pasted);
      }
    },
    [submit],
  );

  const isComplete = digits.every((d) => d !== '');

  if (isLocked) {
    return (
      <AuthLayout icon={shieldIcon} title={title} description={description}>
        <div className="space-y-10">
          {lockedMessage && (
            <Alert variant="destructive" icon={<InfoIcon className="w-[18px] h-[18px]" />}>
              {lockedMessage}
            </Alert>
          )}

          {contactSupportLabel && onContactSupport && (
            <div className="text-center">
              <button type="button" className="hover:underline" onClick={onContactSupport}>
                <Text variant="body-18" as="span" className="font-medium text-foreground">
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
      <AuthLayout icon={shieldIcon} title={title} description={description}>
        <div className="flex flex-col gap-[72px]">
          <div className="flex flex-col items-center gap-8">
            <EmailBadge email={email} />

            <div className="flex items-center justify-center gap-2">
              <ClockIcon className="w-4 h-4 text-foreground" />
              <Text variant="body-16" as="span">
                {expiredText}
              </Text>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Button size="lg" className="w-full" onClick={handleResend} isLoading={isResending}>
              {resendLabel}
            </Button>

            <Button variant="secondary" size="lg" className="w-full" onClick={onBackToLogin}>
              {backLabel}
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={shieldIcon} title={title} description={description}>
      <div className="flex flex-col gap-[72px]">
        <div className="flex flex-col items-center gap-8">
          <EmailBadge email={email} />

          <div className="flex w-full flex-col gap-4">
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
                    'w-14 h-14 text-center text-base font-normal leading-6 transition-colors',
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

            <div className="flex items-center justify-center gap-2">
              <ClockIcon className="w-4 h-4 text-foreground" />
              <Text variant="body-16" as="span">
                {expiresInText} {formatTime(secondsLeft)}
              </Text>
            </div>

            {isError && errorMessage && (
              <Alert variant="destructive" icon={<InfoIcon className="w-[18px] h-[18px]" />}>
                {errorMessage}
              </Alert>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Button
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            isLoading={isPending}
            disabled={!isComplete || isPending}
          >
            {verifyLabel}
          </Button>

          <div className="text-center">
            <Text variant="body-16" as="p">
              {didntReceiveText}{' '}
              {resendCooldown > 0 ? (
                resendTimerText(formatTime(resendCooldown))
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending}
                  className="font-medium underline hover:no-underline disabled:opacity-50"
                >
                  {resendLabel}
                </button>
              )}
            </Text>
          </div>

          <Button variant="secondary" size="lg" className="w-full" onClick={onBackToLogin}>
            {backLabel}
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
