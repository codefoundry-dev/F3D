import { type ElementType, type ReactNode } from 'react';

import { cn } from '../utils/cn';

const variantStyles = {
  'title-l': 'text-[28px] leading-[140%] font-normal text-foreground',
  'title-m': 'text-[24px] leading-[140%] font-normal text-foreground',
  'title-s': 'text-[20px] leading-[140%] font-normal text-foreground',
  'body-18': 'text-[18px] leading-[140%] font-normal text-secondary-foreground',
  'body-16': 'text-[16px] leading-[140%] font-normal text-secondary-foreground',
  'body-14': 'text-[14px] leading-[140%] font-normal text-muted-foreground',
  'body-12': 'text-[12px] leading-[140%] font-normal text-muted-foreground',
  'label-l': 'text-[16px] leading-none font-medium text-foreground',
  'label-m': 'text-[14px] leading-none font-medium text-foreground',
  'label-s': 'text-[12px] leading-none font-medium text-foreground',
} as const;

export type TextVariant = keyof typeof variantStyles;

export interface TextProps {
  variant?: TextVariant;
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

export function Text({ variant = 'body-16', as: Tag = 'p', className, children }: TextProps) {
  return <Tag className={cn(variantStyles[variant], className)}>{children}</Tag>;
}
