export type SortField = 'name' | 'email' | 'phone' | 'role' | 'status' | 'dateJoined';
export type SortDir = 'asc' | 'desc';

export const TABS = ['platformUsers', 'vendors', 'actionLog'] as const;

export const PAGE_SIZE_OPTIONS = [10, 25, 50];
