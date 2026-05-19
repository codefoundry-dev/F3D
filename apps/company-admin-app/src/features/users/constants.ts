export type SortField = 'name' | 'email' | 'phone' | 'role' | 'status';
export type SortDir = 'asc' | 'desc';

export const TABS = ['companyUsers', 'approvalConfiguration', 'rolePermissions'] as const;

export const PAGE_SIZE_OPTIONS = [10, 25, 50];
