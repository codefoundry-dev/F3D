import { zodResolver } from '@hookform/resolvers/zod';
import { type ReactNode, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import CheckStrokeIcon from '../assets/icons/check-stroke.svg?react';

import { Alert } from './Alert';
import { Button } from './Button';
import { FormField } from './FormField';
import { IconBadge } from './IconBadge';
import { Modal, ModalBody, ModalCloseButton } from './Modal';
import { PasswordInput } from './PasswordInput';
import { Text } from './Text';

export interface PasswordRule {
  key: string;
  label: string;
  test: (value: string) => boolean;
}

export interface ChangePasswordModalLabels {
  title: string;
  description: string;
  currentPassword: string;
  currentPasswordPlaceholder?: string;
  newPassword: string;
  newPasswordPlaceholder?: string;
  confirmNewPassword: string;
  confirmNewPasswordPlaceholder?: string;
  requirementsLabel: string;
  submitLabel: string;
  submittingLabel: string;
  cancelLabel: string;
  successMessage: string;
  passwordMismatch: string;
}

export interface ChangePasswordModalProps {
  onClose: () => void;
  onSubmit: (data: { currentPassword: string; newPassword: string }) => void;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  errorMessage?: string;
  labels: ChangePasswordModalLabels;
  /** Password validation rules with labels and test functions */
  rules?: PasswordRule[];
  /** Icon inside the header badge (e.g. LockIcon) */
  icon: ReactNode;
  /** Icon for password inputs (e.g. LockSimpleIcon) */
  passwordIcon?: ReactNode;
  /** Eye-open icon for password toggle */
  eyeOpenIcon?: ReactNode;
  /** Eye-closed icon for password toggle */
  eyeClosedIcon?: ReactNode;
  /** Check icon for passed rules */
  checkIcon?: ReactNode;
  /** Auto-close delay in ms after success (default 2000). Set 0 to disable. */
  autoCloseDelay?: number;
}

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

const DEFAULT_RULES: PasswordRule[] = [
  { key: 'minLength', label: '8+ characters', test: (v) => v.length >= 8 },
  { key: 'lowercase', label: 'Lowercase letter', test: (v) => /[a-z]/.test(v) },
  { key: 'uppercase', label: 'Uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { key: 'number', label: 'Number', test: (v) => /[0-9]/.test(v) },
  { key: 'special', label: 'Special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export function ChangePasswordModal({
  onClose,
  onSubmit,
  isPending,
  isError,
  isSuccess,
  errorMessage,
  labels,
  rules = DEFAULT_RULES,
  icon,
  passwordIcon,
  eyeOpenIcon,
  eyeClosedIcon,
  checkIcon,
  autoCloseDelay = 2000,
}: ChangePasswordModalProps) {
  const schema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1),
          newPassword: z
            .string()
            .min(8)
            .regex(/[a-z]/)
            .regex(/[A-Z]/)
            .regex(/[0-9]/)
            .regex(/[^A-Za-z0-9]/),
          confirmNewPassword: z.string().min(1),
        })
        .refine((data) => data.newPassword === data.confirmNewPassword, {
          message: labels.passwordMismatch,
          path: ['confirmNewPassword'],
        }),
    [labels.passwordMismatch],
  );

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const newPasswordValue = watch('newPassword');

  const evaluatedRules = useMemo(
    () =>
      rules.map((rule) => ({
        ...rule,
        passed: rule.test(newPasswordValue || ''),
      })),
    [rules, newPasswordValue],
  );

  const allRulesPassed = evaluatedRules.every((r) => r.passed);

  // Auto-close on success
  const stableOnClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!isSuccess || autoCloseDelay <= 0) return;
    const timer = setTimeout(stableOnClose, autoCloseDelay);
    return () => clearTimeout(timer);
  }, [isSuccess, autoCloseDelay, stableOnClose]);

  const handleFormSubmit = (data: FormValues) => {
    onSubmit({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-[560px]">
      <ModalBody>
        <form
          onSubmit={(e) => void handleSubmit(handleFormSubmit)(e)}
          className="space-y-5"
          noValidate
        >
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-2">
            <div className="w-full flex justify-between items-start">
              <div className="flex-1" />
              <IconBadge icon={icon} />
              <div className="flex-1 flex justify-end">
                <ModalCloseButton onClose={onClose} />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-foreground mt-4">{labels.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{labels.description}</p>
          </div>

          {/* Error alert */}
          {isError && errorMessage && <Alert variant="destructive">{errorMessage}</Alert>}

          {/* Success alert */}
          {isSuccess && <Alert variant="success">{labels.successMessage}</Alert>}

          {/* Current Password */}
          <FormField
            label={labels.currentPassword}
            error={errors.currentPassword?.message}
            htmlFor="currentPassword"
            required
          >
            <PasswordInput
              id="currentPassword"
              autoComplete="current-password"
              placeholder={labels.currentPasswordPlaceholder}
              disabled={isPending || isSuccess}
              leftIcon={passwordIcon}
              showIcon={eyeOpenIcon}
              hideIcon={eyeClosedIcon}
              {...register('currentPassword')}
            />
          </FormField>

          {/* New Password */}
          <FormField
            label={labels.newPassword}
            error={errors.newPassword?.message}
            htmlFor="newPassword"
            required
          >
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              placeholder={labels.newPasswordPlaceholder}
              disabled={isPending || isSuccess}
              leftIcon={passwordIcon}
              showIcon={eyeOpenIcon}
              hideIcon={eyeClosedIcon}
              {...register('newPassword')}
            />
          </FormField>

          {/* Confirm New Password */}
          <FormField
            label={labels.confirmNewPassword}
            error={errors.confirmNewPassword?.message}
            htmlFor="confirmNewPassword"
            required
          >
            <PasswordInput
              id="confirmNewPassword"
              autoComplete="new-password"
              placeholder={labels.confirmNewPasswordPlaceholder}
              disabled={isPending || isSuccess}
              leftIcon={passwordIcon}
              showIcon={eyeOpenIcon}
              hideIcon={eyeClosedIcon}
              {...register('confirmNewPassword')}
            />
          </FormField>

          {/* Password requirements checklist */}
          <div>
            <Text variant="label-m" as="p" className="mb-2">
              {labels.requirementsLabel}
            </Text>
            <div className="rounded-xl border border-input bg-muted p-4 grid grid-cols-2 gap-y-2.5 gap-x-4">
              {evaluatedRules.map((rule) => (
                <div key={rule.key} className="flex items-center gap-2">
                  {rule.passed ? (
                    <span className="w-4 h-4 text-success flex-shrink-0">
                      {checkIcon ?? <CheckStrokeIcon className="w-4 h-4" />}
                    </span>
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

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              isLoading={isPending}
              disabled={isSuccess || !allRulesPassed}
              className="w-full"
            >
              {isPending ? labels.submittingLabel : labels.submitLabel}
            </Button>
            <Button variant="outline" type="button" onClick={onClose} className="w-full">
              {labels.cancelLabel}
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
}
