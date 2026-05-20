import { UserRole } from '@forethread/shared-types/client';

export const ALL_ROLE_OPTIONS = [
  UserRole.SUPER_ADMIN,
  UserRole.COMPANY_ADMIN,
  UserRole.PROCUREMENT_OFFICER,
  UserRole.FINANCIAL_OFFICER,
  UserRole.FOREMAN,
  UserRole.WAREHOUSE_OFFICER,
  UserRole.VENDOR,
] as const;

export const CONTRACTOR_ROLE_OPTIONS = [
  UserRole.COMPANY_ADMIN,
  UserRole.PROCUREMENT_OFFICER,
  UserRole.FINANCIAL_OFFICER,
  UserRole.WAREHOUSE_OFFICER,
  UserRole.FOREMAN,
] as const;

export const ROLE_BADGE_COLORS: Record<string, string> = {
  [UserRole.SUPER_ADMIN]: 'bg-badge-purple text-badge-purple-text',
  [UserRole.COMPANY_ADMIN]: 'bg-badge-blue text-badge-blue-text',
  [UserRole.PROCUREMENT_OFFICER]: 'bg-badge-indigo text-badge-indigo-text',
  [UserRole.FINANCIAL_OFFICER]: 'bg-badge-teal text-badge-teal-text',
  [UserRole.WAREHOUSE_OFFICER]: 'bg-badge-orange text-badge-orange-text',
  [UserRole.FOREMAN]: 'bg-badge-amber text-badge-amber-text',
  [UserRole.VENDOR]: 'bg-badge-pink text-badge-pink-text',
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
