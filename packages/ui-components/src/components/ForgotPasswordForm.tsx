import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

import { AuthLayout } from './AuthLayout';
import { Button, buttonVariants } from './Button';
import { FormField } from './FormField';
import { Input } from './Input';

export interface ForgotPasswordFormProps {
  /** Icon inside the header badge (e.g. KeyIcon) */
  icon: ReactNode;
  /** Icon inside the email input (e.g. EnvelopeSimpleIcon) */
  emailIcon: ReactNode;
  /** Title text */
  title: string;
  /** Description text */
  description: string;
  /** Email field label */
  emailLabel: string;
  /** Email field placeholder */
  emailPlaceholder: string;
  /** Email validation error */
  emailError?: string;
  /** Submit button label */
  submitLabel: string;
  /** Back to login label */
  backLabel: string;
  /** Back to login path */
  backPath?: string;
  /** Whether the form is submitting */
  isPending: boolean;
  /** Whether the form is valid (disables submit when false) */
  isValid?: boolean;
  /** Form submit handler — receives the native form event */
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  /** Props to spread on the email input (e.g. from register()) */
  emailInputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}

export function ForgotPasswordForm({
  icon,
  emailIcon,
  title,
  description,
  emailLabel,
  emailPlaceholder,
  emailError,
  submitLabel,
  backLabel,
  backPath = '/login',
  isPending,
  isValid = true,
  onSubmit,
  emailInputProps,
}: ForgotPasswordFormProps) {
  return (
    <AuthLayout icon={icon} title={title} description={description}>
      <form onSubmit={onSubmit} className="flex w-full flex-col gap-10" noValidate>
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

        <div className="flex flex-col gap-2">
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
