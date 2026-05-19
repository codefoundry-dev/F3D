import type { ReactNode } from 'react';

import { Button } from './Button';
import { Text } from './Text';

export interface ErrorFallbackProps {
  title?: string;
  message?: string;
  retryLabel?: string;
  backLabel?: string;
  icon?: ReactNode;
  onRetry?: () => void;
  onBack?: () => void;
}

export function ErrorFallback({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  retryLabel = 'Try again',
  backLabel = 'Go back',
  icon,
  onRetry,
  onBack,
}: ErrorFallbackProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center space-y-6">
        {icon && <div className="flex justify-center">{icon}</div>}

        <div className="space-y-2">
          <Text variant="title-m" as="h1">
            {title}
          </Text>
          <Text variant="body-16" as="p" className="text-muted-foreground">
            {message}
          </Text>
        </div>

        <div className="flex flex-col gap-3">
          {onRetry && (
            <Button size="lg" className="w-full" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          {onBack && (
            <Button variant="outline" size="lg" className="w-full" onClick={onBack}>
              {backLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
