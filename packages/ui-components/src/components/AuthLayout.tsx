import type { ReactNode } from 'react';

import { Text } from './Text';

export interface AuthLayoutProps {
  /** @deprecated Use `title` and `subtitle` inside card instead */
  appName?: string;
  /** @deprecated Use `subtitle` prop */
  subtitle?: string;
  icon?: ReactNode;
  title?: string;
  description?: string;
  children: ReactNode;
}

export function AuthLayout({
  appName,
  subtitle,
  icon,
  title,
  description,
  children,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[560px]">
        {/* Legacy: external header if appName provided and no icon/title */}
        {appName && !icon && !title && (
          <div className="mb-8 text-center">
            <Text variant="title-l" as="h1" className="font-bold">
              {appName}
            </Text>
            {subtitle && (
              <Text variant="body-14" as="p" className="mt-2">
                {subtitle}
              </Text>
            )}
          </div>
        )}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          {icon && <div className="flex justify-center mb-4">{icon}</div>}
          {title && (
            <Text variant="title-m" as="h2" className="text-center mb-2">
              {title}
            </Text>
          )}
          {(description ?? (icon && subtitle)) && (
            <Text variant="body-14" as="p" className="text-center mb-6">
              {description ?? subtitle}
            </Text>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
