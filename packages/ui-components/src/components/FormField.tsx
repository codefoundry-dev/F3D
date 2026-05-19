import type { ReactNode } from 'react';

import { Text } from './Text';

export interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  htmlFor?: string;
  children: ReactNode;
}

export function FormField({ label, error, required, optional, htmlFor, children }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block mb-1.5">
        <Text variant="label-m" as="span">
          {label}
          {required && <span className="text-muted-foreground"> *</span>}
          {optional && <span className="text-muted-foreground font-normal"> (Optional)</span>}
        </Text>
      </label>
      {children}
      {error && (
        <Text variant="body-12" as="p" className="mt-1.5 text-destructive">
          {error}
        </Text>
      )}
    </div>
  );
}
