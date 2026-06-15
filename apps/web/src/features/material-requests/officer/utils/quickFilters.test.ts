import type { MrListItem } from '@forethread/api-client';
import { describe, it, expect } from 'vitest';

import { quickFilterToParams, applyClientQuickFilter, MR_QUICK_FILTERS } from './quickFilters';

const NOW = new Date('2026-06-15T12:00:00.000Z');

function mr(overrides: Partial<MrListItem>): MrListItem {
  return {
    id: 'mr-1',
    mrNumber: 'MR-1',
    status: 'SUBMITTED',
    priority: 'MEDIUM',
    projectId: 'p1',
    project: { id: 'p1', name: 'Proj' },
    requestedBy: { id: 'u1', name: 'Joe' },
    lineItemCount: 1,
    neededByDate: null,
    createdAt: '2026-06-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('quickFilterToParams', () => {
  it('maps server-backed chips to their boolean param', () => {
    expect(quickFilterToParams('awaitingApproval')).toEqual({ awaitingApproval: true });
    expect(quickFilterToParams('urgent')).toEqual({ urgent: true });
    expect(quickFilterToParams('mine')).toEqual({ mine: true });
    expect(quickFilterToParams('approved')).toEqual({ approved: true });
    expect(quickFilterToParams('overdue')).toEqual({ overdue: true });
  });

  it('returns empty params for client-side-only chips and for no selection', () => {
    expect(quickFilterToParams('dueToday')).toEqual({});
    expect(quickFilterToParams('recentlyUpdated')).toEqual({});
    expect(quickFilterToParams('')).toEqual({});
  });

  it('exposes all seven chips in display order', () => {
    expect(MR_QUICK_FILTERS).toEqual([
      'awaitingApproval',
      'urgent',
      'mine',
      'approved',
      'overdue',
      'dueToday',
      'recentlyUpdated',
    ]);
  });
});

describe('applyClientQuickFilter', () => {
  it('dueToday keeps only items needed today', () => {
    const items = [
      mr({ id: 'today', neededByDate: '2026-06-15T08:00:00.000Z' }),
      mr({ id: 'tomorrow', neededByDate: '2026-06-16T08:00:00.000Z' }),
      mr({ id: 'none', neededByDate: null }),
    ];
    const out = applyClientQuickFilter(items, 'dueToday', NOW);
    expect(out.map((i) => i.id)).toEqual(['today']);
  });

  it('recentlyUpdated keeps only items created within the last 7 days', () => {
    const items = [
      mr({ id: 'fresh', createdAt: '2026-06-10T00:00:00.000Z' }),
      mr({ id: 'stale', createdAt: '2026-06-01T00:00:00.000Z' }),
    ];
    const out = applyClientQuickFilter(items, 'recentlyUpdated', NOW);
    expect(out.map((i) => i.id)).toEqual(['fresh']);
  });

  it('passes items through unchanged for server-backed filters and no selection', () => {
    const items = [mr({ id: 'a' }), mr({ id: 'b' })];
    expect(applyClientQuickFilter(items, 'approved', NOW)).toHaveLength(2);
    expect(applyClientQuickFilter(items, '', NOW)).toHaveLength(2);
  });
});
