import type { ReactNode } from 'react';

import { Alert } from './Alert';
import { AuthLayout } from './AuthLayout';
import { Button } from './Button';
import { Text } from './Text';

export interface CheckEmailCardProps {
  /** Icon inside the badge (e.g. CheckCircleIcon) */
  icon: ReactNode;
  /** Title text */
  title: string;
  /** Subtitle/description text */
  subtitle: string;
  /** Alert content — can contain <Trans> for bold email */
  alertContent: ReactNode;
  /** Expiry explanation text */
  expiryText: string;
  /** List of tips (spam, verify, retry) */
  tips: string[];
  /** Primary button label (e.g. "Back to Log in") */
  backLabel: string;
  /** Resend link label */
  resendLabel: string;
  /** Whether the resend request is in progress */
  isResending: boolean;
  /** Back to login handler */
  onBackToLogin: () => void;
  /** Resend email handler */
  onResend: () => void;
}

export function CheckEmailCard({
  icon,
  title,
  subtitle,
  alertContent,
  expiryText,
  tips,
  backLabel,
  resendLabel,
  isResending,
  onBackToLogin,
  onResend,
}: CheckEmailCardProps) {
  return (
    <AuthLayout icon={icon} title={title} description={subtitle}>
      <div className="space-y-10">
        <Alert variant="success">{alertContent}</Alert>

        <div className="text-secondary-foreground space-y-3">
          <Text variant="body-16">{expiryText}</Text>
          <ul className="list-disc pl-5 space-y-1">
            {tips.map((tip) => (
              <li key={tip}>
                <Text variant="body-16" as="span">
                  {tip}
                </Text>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <Button size="lg" className="w-full" onClick={onBackToLogin}>
            {backLabel}
          </Button>

          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={onResend}
            isLoading={isResending}
          >
            {resendLabel}
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
