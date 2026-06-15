import type { PoAuditEntry } from '@forethread/api-client';
import { describe, it, expect } from 'vitest';

import { humanizeAuditAction } from './po-audit-log';

function makeEntry(overrides: Partial<PoAuditEntry> = {}): PoAuditEntry {
  return {
    id: 'audit-1',
    action: 'PO_APPROVED',
    metadata: null,
    performedBy: { id: 'u-1', name: 'Sarah', email: 'sarah@example.com' },
    createdAt: '2026-01-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('humanizeAuditAction', () => {
  it('maps a lifecycle action with a reason into label + "Performed by … — reason"', () => {
    const entry = makeEntry({
      action: 'PO_DECLINED',
      metadata: { from: 'PENDING_APPROVAL', to: 'DECLINED', reason: 'Budget exceeded' },
    });

    const result = humanizeAuditAction(entry);

    expect(result).not.toBeNull();
    expect(result?.action).toBe('Purchase order declined');
    expect(result?.description).toBe('Performed by Sarah — Budget exceeded');
    expect(result?.performedBy).toEqual({ id: 'u-1', name: 'Sarah' });
    expect(result?.id).toBe('audit-1');
    expect(result?.createdAt).toBe('2026-01-01T10:00:00.000Z');
  });

  it('maps a delivery action (PO_PARTIALLY_DELIVERED)', () => {
    const result = humanizeAuditAction(
      makeEntry({
        action: 'PO_PARTIALLY_DELIVERED',
        metadata: { from: 'ACCEPTED', to: 'PARTIALLY_DELIVERED' },
      }),
    );

    expect(result?.action).toBe('Partially delivered');
    expect(result?.description).toBe('Performed by Sarah');
  });

  it('relabels PO_ISSUED → "Submitted for approval" when it lands in PENDING_APPROVAL', () => {
    const result = humanizeAuditAction(
      makeEntry({ action: 'PO_ISSUED', metadata: { to: 'PENDING_APPROVAL' } }),
    );

    expect(result?.action).toBe('Submitted for approval');
  });

  it('keeps PO_ISSUED → "Purchase order issued" for a normal issue', () => {
    const result = humanizeAuditAction(
      makeEntry({ action: 'PO_ISSUED', metadata: { to: 'SENT' } }),
    );

    expect(result?.action).toBe('Purchase order issued');
  });

  it('falls back to a System performer and null description when performedBy is null', () => {
    const result = humanizeAuditAction(
      makeEntry({ action: 'PO_DELIVERED', performedBy: null, metadata: null }),
    );

    expect(result?.action).toBe('Delivered');
    expect(result?.performedBy).toEqual({ id: '', name: 'System' });
    expect(result?.description).toBeNull();
  });

  it('returns null for change-request actions (surfaced via the changeRequests prop)', () => {
    expect(humanizeAuditAction(makeEntry({ action: 'PO_CHANGE_PROPOSED' }))).toBeNull();
    expect(humanizeAuditAction(makeEntry({ action: 'PO_CHANGE_APPROVED' }))).toBeNull();
    expect(humanizeAuditAction(makeEntry({ action: 'PO_CHANGE_REJECTED' }))).toBeNull();
  });

  it('returns null for an unknown action', () => {
    expect(humanizeAuditAction(makeEntry({ action: 'PO_SOMETHING_NEW' }))).toBeNull();
  });

  it('uses the supplied translate function for labels', () => {
    const t = (key: string, fallback: string) => `t:${key}:${fallback}`;
    const result = humanizeAuditAction(makeEntry({ action: 'PO_APPROVED' }), t);

    expect(result?.action).toBe('t:actionLog.approved:Purchase order approved');
    // performedBy line is translated too, with {{name}} substituted post-translation.
    expect(result?.description).toBe('t:actionLog.performedBy:Performed by Sarah');
  });
});
