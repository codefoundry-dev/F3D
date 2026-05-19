export type SortField = 'companyName' | 'email' | 'status' | 'assignedAt';
export type SortDir = 'asc' | 'desc';

export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 25;

export const STATUS_COLORS: Record<string, string> = {
  INVITED: 'bg-amber-100 text-amber-800',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  DEACTIVATED: 'bg-red-100 text-red-800',
};

export const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};

export const PLACE_TYPES = {
  COUNTRY: ['country'] as string[],
  CITY: ['locality', 'administrative_area_level_1'] as string[],
  ADDRESS: ['street_address', 'route'] as string[],
} as const;
