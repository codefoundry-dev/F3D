import type { ReactNode } from 'react';

import { Alert } from './Alert';
import { AuthLayout } from './AuthLayout';
import { Button } from './Button';
import { FormField } from './FormField';
import { IconBadge } from './IconBadge';
import { Input } from './Input';
import { PasswordInput } from './PasswordInput';
import { Text } from './Text';

export interface LoginFormProps {
  /** Icon inside the badge (e.g. HandWavingIcon) */
  icon: ReactNode;
  /** Icon for the email input (e.g. EnvelopeSimpleIcon) */
  emailIcon: ReactNode;
  /** Icon for the password input (e.g. LockSimpleIcon) */
  passwordIcon: ReactNode;
  /** Eye-open icon for password toggle */
  eyeOpenIcon: ReactNode;
  /** Eye-closed icon for password toggle */
  eyeClosedIcon: ReactNode;
  /** Error alert icon (e.g. InfoIcon) */
  errorIcon?: ReactNode;
  /** Title text */
  title: string;
  /** Description text */
  description: string;
  /** Email field label */
  emailLabel: string;
  /** Email placeholder */
  emailPlaceholder: string;
  /** Email validation error */
  emailError?: string;
  /** Password field label */
  passwordLabel: string;
  /** Password placeholder */
  passwordPlaceholder?: string;
  /** Password validation error */
  passwordError?: string;
  /** Forgot password label */
  forgotPasswordLabel: string;
  /** Forgot password path */
  forgotPasswordPath?: string;
  /** Submit button label */
  submitLabel: string;
  /** Whether a login error occurred */
  isError: boolean;
  /** Error message text */
  errorMessage?: string;
  /** Whether the form is submitting */
  isPending: boolean;
  /** Whether the form is valid (disables submit when false) */
  isValid?: boolean;
  /** Form submit handler */
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  /** Props to spread on the email input */
  emailInputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  /** Props to spread on the password input */
  passwordInputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}

export function LoginForm({
  icon,
  emailIcon,
  passwordIcon,
  eyeOpenIcon,
  eyeClosedIcon,
  errorIcon,
  title,
  description,
  emailLabel,
  emailPlaceholder,
  emailError,
  passwordLabel,
  passwordPlaceholder = '••••••••',
  passwordError,
  forgotPasswordLabel,
  forgotPasswordPath = '/forgot-password',
  submitLabel,
  isError,
  errorMessage,
  isPending,
  isValid = true,
  onSubmit,
  emailInputProps,
  passwordInputProps,
}: LoginFormProps) {
  return (
    <AuthLayout icon={<IconBadge icon={icon} />} title={title} description={description}>
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {isError && errorMessage && (
          <Alert variant="destructive" icon={errorIcon}>
            {errorMessage}
          </Alert>
        )}

        <div className="space-y-4">
          <FormField label={emailLabel} error={emailError} htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={emailPlaceholder}
              disabled={isPending}
              leftIcon={emailIcon}
              {...emailInputProps}
            />
          </FormField>

          <FormField label={passwordLabel} error={passwordError} htmlFor="password">
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder={passwordPlaceholder}
              disabled={isPending}
              leftIcon={passwordIcon}
              showIcon={eyeOpenIcon}
              hideIcon={eyeClosedIcon}
              {...passwordInputProps}
            />
          </FormField>

          <div className="flex justify-between items-center">
            <a href={forgotPasswordPath} className="text-foreground hover:underline">
              <Text variant="label-l" as="span">
                {forgotPasswordLabel}
              </Text>
            </a>
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          isLoading={isPending}
          disabled={!isValid}
          className="w-full"
        >
          {submitLabel}
        </Button>
      </form>
    </AuthLayout>
  );
}
