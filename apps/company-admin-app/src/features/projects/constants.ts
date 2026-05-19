export const PAGE_SIZE = 25;

export const PROJECT_STATUSES = ['PLANNED', 'ONGOING', 'COMPLETED', 'ARCHIVED'] as const;

export const STATUS_COLOR_MAP: Record<string, string> = {
  PLANNED: 'bg-[hsl(var(--badge-blue))] text-[hsl(var(--badge-blue-text))]',
  ONGOING: 'bg-[hsl(var(--badge-teal))] text-[hsl(var(--badge-teal-text))]',
  COMPLETED: 'bg-success/10 text-success',
  ARCHIVED: 'bg-[hsl(var(--badge-orange))] text-[hsl(var(--badge-orange-text))]',
};
