import type { MrListItem, MrListParams } from '@forethread/api-client';

/**
 * Officer dashboard quick-filter keys (US 2.08). Each maps either to a server
 * param on `getMaterialRequests` or to a client-side predicate over the
 * returned items (the list endpoint exposes no param for those).
 */
export type MrQuickFilter =
  | 'awaitingApproval'
  | 'urgent'
  | 'mine'
  | 'approved'
  | 'overdue'
  | 'dueToday'
  | 'recentlyUpdated';

/** Display order of the chips (matches the Figma layout). */
export const MR_QUICK_FILTERS: MrQuickFilter[] = [
  'awaitingApproval',
  'urgent',
  'mine',
  'approved',
  'overdue',
  'dueToday',
  'recentlyUpdated',
];

/** Quick filters backed by a server param vs. applied client-side. */
const SERVER_PARAM: Partial<Record<MrQuickFilter, keyof MrListParams>> = {
  awaitingApproval: 'awaitingApproval',
  urgent: 'urgent',
  mine: 'mine',
  approved: 'approved',
  overdue: 'overdue',
};

/**
 * Build the `getMaterialRequests` params for the active quick filter. Returns an
 * empty object for client-side-only filters (dueToday / recentlyUpdated) and
 * when nothing is selected.
 */
export function quickFilterToParams(filter: MrQuickFilter | ''): MrListParams {
  if (!filter) return {};
  const param = SERVER_PARAM[filter];
  return param ? { [param]: true } : {};
}

function isSameLocalDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

/**
 * Apply the client-side quick filters to the server-returned items.
 *
 * - `dueToday` — `neededByDate` is today (no server param exists).
 * - `recentlyUpdated` — created within the last 7 days. The list contract has
 *   no `updatedAt`, so this is a created-date proxy.
 *   US 2.08 follow-up: expose `updatedAt` on MrListItem for a true filter.
 *
 * Server-backed filters are pass-through here (the server already applied them).
 */
export function applyClientQuickFilter(
  items: MrListItem[],
  filter: MrQuickFilter | '',
  now: Date = new Date(),
): MrListItem[] {
  if (filter === 'dueToday') {
    return items.filter((mr) => mr.neededByDate && isSameLocalDay(mr.neededByDate, now));
  }
  if (filter === 'recentlyUpdated') {
    const sevenDaysAgo = now.getTime() - 7 * 86_400_000;
    return items.filter((mr) => new Date(mr.createdAt).getTime() >= sevenDaysAgo);
  }
  return items;
}
