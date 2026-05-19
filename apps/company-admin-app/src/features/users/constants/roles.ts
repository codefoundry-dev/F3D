import { UserRole } from '@forethread/shared-types/client';

export const COMPANY_ROLE_OPTIONS = [
  UserRole.COMPANY_ADMIN,
  UserRole.PROCUREMENT_OFFICER,
  UserRole.FINANCIAL_OFFICER,
  UserRole.FOREMAN,
  UserRole.WAREHOUSE_OFFICER,
] as const;

export type CompanyUserRole = (typeof COMPANY_ROLE_OPTIONS)[number];

export const ROLE_BADGE_COLORS: Record<string, string> = {
  [UserRole.COMPANY_ADMIN]: 'bg-badge-blue text-badge-blue-text',
  [UserRole.PROCUREMENT_OFFICER]: 'bg-badge-indigo text-badge-indigo-text',
  [UserRole.FINANCIAL_OFFICER]: 'bg-badge-teal text-badge-teal-text',
  [UserRole.WAREHOUSE_OFFICER]: 'bg-badge-orange text-badge-orange-text',
  [UserRole.FOREMAN]: 'bg-badge-amber text-badge-amber-text',
};

export const STATUS_BADGE_COLORS: Record<string, string> = {
  ACTIVE: 'bg-success/10 text-success',
  INACTIVE: 'bg-muted text-muted-foreground',
  INVITED: 'bg-warning/10 text-warning',
};

export const STATUS_TEXT_COLORS: Record<string, string> = {
  ACTIVE: 'text-foreground',
  INACTIVE: 'text-muted-foreground',
  INVITED: 'text-foreground',
};
