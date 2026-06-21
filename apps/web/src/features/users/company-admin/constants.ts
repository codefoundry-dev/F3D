import { UserRole, UserStatus } from '@forethread/shared-types/client';

export type SortField = 'name' | 'email' | 'phone' | 'role' | 'status';
export type SortDir = 'asc' | 'desc';

export const TABS = ['companyUsers', 'approvalConfiguration', 'rolePermissions'] as const;

export const PAGE_SIZE_OPTIONS = [10, 25, 50];

/** Roles a contractor (buyer) company can hold — drives the list role filter. */
export const COMPANY_ROLE_OPTIONS: readonly UserRole[] = [
  UserRole.COMPANY_ADMIN,
  UserRole.PROCUREMENT_OFFICER,
  UserRole.FINANCIAL_OFFICER,
  UserRole.WAREHOUSE_OFFICER,
  UserRole.FOREMAN,
] as const;

/** Status values shown in the list status filter. */
export const STATUS_OPTIONS: readonly UserStatus[] = [
  UserStatus.ACTIVE,
  UserStatus.INACTIVE,
  UserStatus.INVITED,
] as const;
