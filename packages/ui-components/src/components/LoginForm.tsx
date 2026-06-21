import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import LogoFull from '../assets/logo-full.svg?react';

import { Alert } from './Alert';
import { AuthLayout } from './AuthLayout';
import { Button } from './Button';
import { FormField } from './FormField';
import { Input } from './Input';
import { PasswordInput } from './PasswordInput';

export interface LoginFormProps {
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
    <AuthLayout
      logo={<LogoFull className="h-[52px] w-auto" aria-label="Forethread" />}
      title={title}
      description={description}
    >
      <form onSubmit={onSubmit} className="flex w-full flex-col gap-10" noValidate>
        <div className="flex w-full flex-col gap-4">
          {isError && errorMessage && (
            <Alert variant="destructive" icon={errorIcon}>
              {errorMessage}
            </Alert>
          )}

          <div className="flex w-full flex-col gap-6">
            <FormField label={emailLabel} error={emailError} htmlFor="email" labelSize="lg">
              <Input
                id="email"
                type="email"
                inputSize="lg"
                autoComplete="email"
                placeholder={emailPlaceholder}
                disabled={isPending}
                leftIcon={emailIcon}
                {...emailInputProps}
              />
            </FormField>

            <FormField
              label={passwordLabel}
              error={passwordError}
              htmlFor="password"
              labelSize="lg"
            >
              <PasswordInput
                id="password"
                inputSize="lg"
                autoComplete="current-password"
                placeholder={passwordPlaceholder}
                disabled={isPending}
                leftIcon={passwordIcon}
                showIcon={eyeOpenIcon}
                hideIcon={eyeClosedIcon}
                {...passwordInputProps}
              />
            </FormField>
          </div>

          <Link
            to={forgotPasswordPath}
            className="self-end text-[14px] font-semibold leading-none tracking-[0.3px] text-gray-800 underline underline-offset-[3px] hover:no-underline"
          >
            {forgotPasswordLabel}
          </Link>
        </div>

        <Button
          type="submit"
          size="lg"
          variant="primary"
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
