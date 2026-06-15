import type { MrAuditEntry } from '@forethread/api-client';
import { describe, it, expect } from 'vitest';

import { humanizeMrAuditAction } from './humanizeMrAuditAction';

const base: MrAuditEntry = {
  id: 'a1',
  action: 'MATERIAL_REQUEST_SUBMITTED',
  metadata: null,
  performedBy: { id: 'u1', name: 'Jane Officer', email: 'jane@x.com' },
  createdAt: '2026-06-15T10:00:00.000Z',
};

describe('humanizeMrAuditAction', () => {
  it('maps each lifecycle action to its English label', () => {
    const cases: Array<[string, string]> = [
      ['MATERIAL_REQUEST_CREATED', 'Request created'],
      ['MATERIAL_REQUEST_SUBMITTED', 'Submitted for approval'],
      ['MATERIAL_REQUEST_APPROVED', 'Approved'],
      ['MATERIAL_REQUEST_DECLINED', 'Declined'],
      ['MATERIAL_REQUEST_CANCELLED', 'Cancelled'],
    ];
    for (const [action, label] of cases) {
      expect(humanizeMrAuditAction({ ...base, action })?.label).toBe(label);
    }
  });

  it('distinguishes converted-to-RFQ from converted-to-PO via metadata.target', () => {
    const rfq = humanizeMrAuditAction({
      ...base,
      action: 'MATERIAL_REQUEST_CONVERTED',
      metadata: { target: 'RFQ', rfqId: 'rfq-1' },
    });
    const po = humanizeMrAuditAction({
      ...base,
      action: 'MATERIAL_REQUEST_CONVERTED',
      metadata: { target: 'PO', poId: 'po-1' },
    });
    expect(rfq?.label).toBe('Converted to RFQ');
    expect(po?.label).toBe('Converted to purchase order');
  });

  it('falls back to a generic Converted label when target is missing', () => {
    const entry = humanizeMrAuditAction({
      ...base,
      action: 'MATERIAL_REQUEST_CONVERTED',
      metadata: {},
    });
    expect(entry?.label).toBe('Converted');
  });

  it('passes the decline reason through on reason', () => {
    const entry = humanizeMrAuditAction({
      ...base,
      action: 'MATERIAL_REQUEST_DECLINED',
      metadata: { reason: 'Budget exceeded' },
    });
    expect(entry?.reason).toBe('Budget exceeded');
  });

  it('ignores blank or non-string reasons', () => {
    expect(
      humanizeMrAuditAction({
        ...base,
        action: 'MATERIAL_REQUEST_DECLINED',
        metadata: { reason: '   ' },
      })?.reason,
    ).toBeNull();
  });

  it('returns the performer name, or null for system events', () => {
    expect(humanizeMrAuditAction(base)?.performedBy).toBe('Jane Officer');
    expect(humanizeMrAuditAction({ ...base, performedBy: null })?.performedBy).toBeNull();
  });

  it('returns null for unrecognised actions', () => {
    expect(humanizeMrAuditAction({ ...base, action: 'SOMETHING_ELSE' })).toBeNull();
  });

  it('uses the supplied translate function when provided', () => {
    const t = (key: string) => `t:${key}`;
    expect(humanizeMrAuditAction({ ...base, action: 'MATERIAL_REQUEST_APPROVED' }, t)?.label).toBe(
      't:auditActions.approved',
    );
  });
});
