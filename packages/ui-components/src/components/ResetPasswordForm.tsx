import { type ReactNode, useState, useEffect, useCallback } from 'react';

import { cn } from '../utils/cn';

import { Alert } from './Alert';
import { AuthLayout } from './AuthLayout';
import { Button, buttonVariants } from './Button';
import { FormField } from './FormField';
import { PasswordInput } from './PasswordInput';
import { Text } from './Text';

export interface PasswordRule {
  label: string;
  passed: boolean;
}

export interface ResetPasswordFormProps {
  /** Icon inside the header badge (e.g. KeyIcon) */
  icon: ReactNode;
  /** Icon for password inputs (e.g. LockSimpleIcon) */
  passwordIcon: ReactNode;
  /** Eye-open icon for password toggle */
  eyeOpenIcon: ReactNode;
  /** Eye-closed icon for password toggle */
  eyeClosedIcon: ReactNode;
  /** Check icon for passed rules */
  checkIcon: ReactNode;
  /** Error alert icon */
  errorIcon?: ReactNode;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** New password field label */
  newPasswordLabel: string;
  /** New password placeholder */
  newPasswordPlaceholder?: string;
  /** Confirm password field label */
  confirmPasswordLabel: string;
  /** Confirm password placeholder */
  confirmPasswordPlaceholder?: string;
  /** Password requirements heading */
  requirementsLabel: string;
  /** Password validation rules */
  rules: PasswordRule[];
  /** Submit button label */
  submitLabel: string;
  /** Back to login label */
  backLabel: string;
  /** Back to login path */
  backPath?: string;
  /** Whether form is submitting */
  isPending: boolean;
  /** Whether the form is valid (disables submit when false) */
  isValid?: boolean;
  /** Whether reset succeeded */
  isSuccess: boolean;
  /** Error alert content (e.g. mismatch message or link expired) */
  errorContent?: ReactNode;
  /** Success alert content */
  successContent?: ReactNode;
  /** Form submit handler */
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  /** Props for new password input */
  newPasswordInputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  /** Props for confirm password input */
  confirmPasswordInputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  /** Success screen: title */
  successTitle?: string;
  /** Success screen: subtitle */
  successSubtitle?: string;
  /** Success screen: alert body text */
  successAlertContent?: ReactNode;
  /** Success screen: back to login button label */
  successBackLabel?: string;
  /** Success screen: redirect countdown text (use {{seconds}} placeholder) */
  successRedirectText?: string;
  /** Called when auto-redirect countdown reaches 0 */
  onRedirectToLogin?: () => void;
}

export function ResetPasswordForm({
  icon,
  passwordIcon,
  eyeOpenIcon,
  eyeClosedIcon,
  checkIcon,
  errorIcon,
  title,
  description,
  newPasswordLabel,
  newPasswordPlaceholder,
  confirmPasswordLabel,
  confirmPasswordPlaceholder,
  requirementsLabel,
  rules,
  submitLabel,
  backLabel,
  backPath = '/login',
  isPending,
  isValid = true,
  isSuccess,
  errorContent,
  successContent,
  onSubmit,
  newPasswordInputProps,
  confirmPasswordInputProps,
  successTitle,
  successSubtitle,
  successAlertContent,
  successBackLabel,
  successRedirectText,
  onRedirectToLogin,
}: ResetPasswordFormProps) {
  const [countdown, setCountdown] = useState(5);

  const handleRedirect = useCallback(() => {
    if (onRedirectToLogin) {
      onRedirectToLogin();
    } else {
      window.location.assign(backPath);
    }
  }, [onRedirectToLogin, backPath]);

  useEffect(() => {
    if (!isSuccess) return;
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isSuccess, handleRedirect]);

  if (isSuccess && successTitle) {
    return (
      <AuthLayout icon={checkIcon} title={successTitle} description={successSubtitle}>
        <div className="space-y-10">
          {successAlertContent && <Alert variant="success">{successAlertContent}</Alert>}

          <Button type="button" size="lg" className="w-full" onClick={handleRedirect}>
            {successBackLabel ?? backLabel}
          </Button>

          {successRedirectText && (
            <Text variant="body-14" as="p" className="text-center">
              {successRedirectText.replace('{{seconds}}', String(countdown))}
            </Text>
          )}
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={icon} title={title} description={description}>
      <form onSubmit={onSubmit} className="flex w-full flex-col gap-10" noValidate>
        <div className="flex w-full flex-col gap-4">
          {(Boolean(errorContent) || Boolean(successContent)) && (
            <div className="space-y-2">
              {errorContent && (
                <Alert variant="destructive" icon={errorIcon}>
                  {errorContent}
                </Alert>
              )}
              {successContent && (
                <Alert variant="success" icon={checkIcon}>
                  {successContent}
                </Alert>
              )}
            </div>
          )}

          <div className="flex w-full flex-col gap-6">
            <FormField label={newPasswordLabel} htmlFor="newPassword" labelSize="lg">
              <PasswordInput
                id="newPassword"
                inputSize="lg"
                autoComplete="new-password"
                placeholder={newPasswordPlaceholder}
                disabled={isPending || isSuccess}
                leftIcon={passwordIcon}
                showIcon={eyeOpenIcon}
                hideIcon={eyeClosedIcon}
                {...newPasswordInputProps}
              />
            </FormField>

            <FormField label={confirmPasswordLabel} htmlFor="confirmPassword" labelSize="lg">
              <PasswordInput
                id="confirmPassword"
                inputSize="lg"
                autoComplete="new-password"
                placeholder={confirmPasswordPlaceholder}
                disabled={isPending || isSuccess}
                leftIcon={passwordIcon}
                showIcon={eyeOpenIcon}
                hideIcon={eyeClosedIcon}
                {...confirmPasswordInputProps}
              />
            </FormField>
          </div>

          <div className="h-px w-full bg-gray-100" />

          <div className="flex flex-col gap-3">
            <Text variant="body-14" as="p" className="text-gray-800">
              {requirementsLabel}
            </Text>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {rules.map((rule) => (
                <div key={rule.label} className="flex items-center gap-2">
                  {rule.passed ? (
                    <span className="flex size-[18px] shrink-0 items-center justify-center text-success">
                      {checkIcon}
                    </span>
                  ) : (
                    <span className="size-[18px] shrink-0 rounded-full border border-gray-300" />
                  )}
                  <Text
                    variant="body-14"
                    as="span"
                    className={rule.passed ? 'text-success' : 'text-gray-800'}
                  >
                    {rule.label}
                  </Text>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            size="lg"
            variant="primary"
            isLoading={isPending}
            disabled={isSuccess || !isValid}
            className="w-full"
          >
            {submitLabel}
          </Button>

          <a
            href={backPath}
            className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'w-full')}
          >
            {backLabel}
          </a>
        </div>
      </form>
    </AuthLayout>
  );
}
