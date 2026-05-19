import { type ReactNode, useState, useEffect, useCallback } from 'react';

import { Alert } from './Alert';
import { AuthLayout } from './AuthLayout';
import { Button } from './Button';
import { FormField } from './FormField';
import { IconBadge } from './IconBadge';
import { PasswordInput } from './PasswordInput';
import { Text } from './Text';

export interface PasswordRule {
  label: string;
  passed: boolean;
}

export interface ResetPasswordFormProps {
  /** Icon inside the badge (e.g. KeyIcon) */
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
      <AuthLayout
        icon={<IconBadge icon={checkIcon} />}
        title={successTitle}
        description={successSubtitle}
      >
        <div className="space-y-6">
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
    <AuthLayout icon={<IconBadge icon={icon} />} title={title} description={description}>
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
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

        <div className="space-y-4">
          <FormField label={newPasswordLabel} htmlFor="newPassword">
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              placeholder={newPasswordPlaceholder}
              disabled={isPending || isSuccess}
              leftIcon={passwordIcon}
              showIcon={eyeOpenIcon}
              hideIcon={eyeClosedIcon}
              {...newPasswordInputProps}
            />
          </FormField>

          <FormField label={confirmPasswordLabel} htmlFor="confirmPassword">
            <PasswordInput
              id="confirmPassword"
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

        <div>
          <Text variant="label-m" as="p" className="mb-2">
            {requirementsLabel}
          </Text>
          <div className="rounded-xl border border-input bg-muted p-4 grid grid-cols-2 gap-y-2.5 gap-x-4">
            {rules.map((rule) => (
              <div key={rule.label} className="flex items-center gap-2">
                {rule.passed ? (
                  <span className="w-4 h-4 text-success flex-shrink-0">{checkIcon}</span>
                ) : (
                  <span className="w-4 h-4 rounded-full border border-muted-foreground/40 flex-shrink-0" />
                )}
                <Text
                  variant="body-14"
                  as="span"
                  className={rule.passed ? 'text-success' : undefined}
                >
                  {rule.label}
                </Text>
              </div>
            ))}
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          isLoading={isPending}
          disabled={isSuccess || !isValid}
          className="w-full"
        >
          {submitLabel}
        </Button>

        <div className="text-center">
          <a href={backPath} className="text-foreground hover:underline">
            <Text variant="label-m" as="span">
              {backLabel}
            </Text>
          </a>
        </div>
      </form>
    </AuthLayout>
  );
}
