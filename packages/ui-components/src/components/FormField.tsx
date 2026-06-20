import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

import { Text } from './Text';

export interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  htmlFor?: string;
  /** Label size — `sm` (14px, default) or `lg` (16px Body/L, used by auth screens). */
  labelSize?: 'sm' | 'lg';
  children: ReactNode;
}

export function FormField({
  label,
  error,
  required,
  optional,
  htmlFor,
  labelSize = 'sm',
  children,
}: FormFieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className={cn('mb-1.5 block', labelSize === 'lg' && 'px-2')}>
        <Text
          variant={labelSize === 'lg' ? 'label-l' : 'label-m'}
          as="span"
          className={labelSize === 'lg' ? 'text-gray-800' : undefined}
        >
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
