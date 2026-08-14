import type { NotificationItem } from '@forethread/api-client';
import { describe, expect, it } from 'vitest';

import { resolveNotificationLink } from './notificationLink';

const base: NotificationItem = {
  id: 'n-1',
  type: 'MESSAGE_RECEIVED',
  title: 'x',
  body: null,
  entityType: null,
  entityId: null,
  metadata: null,
  readAt: null,
  createdAt: '2026-07-24T00:00:00.000Z',
};

describe('resolveNotificationLink', () => {
  it('links an RFQ notification to the RFQ detail page', () => {
    expect(resolveNotificationLink({ ...base, entityType: 'RFQ', entityId: 'rfq-1' })).toBe(
      '/rfqs/rfq-1',
    );
  });

  it('links a purchase order notification to the PO detail page', () => {
    expect(
      resolveNotificationLink({ ...base, entityType: 'PURCHASE_ORDER', entityId: 'po-9' }),
    ).toBe('/purchase-orders/po-9');
  });

  it('links a bulk order notification to the bulk order detail page', () => {
    expect(resolveNotificationLink({ ...base, entityType: 'BULK_ORDER', entityId: 'bo-3' })).toBe(
      '/bulk-orders/bo-3',
    );
  });

  it('links an invoice notification to the invoice detail page', () => {
    expect(resolveNotificationLink({ ...base, entityType: 'INVOICE', entityId: 'inv-4' })).toBe(
      '/invoices/inv-4',
    );
  });

  it('links a material request notification to the MR detail page (FOR-347)', () => {
    expect(
      resolveNotificationLink({ ...base, entityType: 'MATERIAL_REQUEST', entityId: 'mr-2' }),
    ).toBe('/material-requests/mr-2');
  });

  it('links a quote-response notification to the nested quote page using metadata.rfqId', () => {
    expect(
      resolveNotificationLink({
        ...base,
        entityType: 'QUOTE_RESPONSE',
        entityId: 'quote-7',
        metadata: { rfqId: 'rfq-5' },
      }),
    ).toBe('/rfqs/rfq-5/quotes/quote-7');
  });

  it('returns null for a quote-response without an rfqId in metadata', () => {
    expect(
      resolveNotificationLink({ ...base, entityType: 'QUOTE_RESPONSE', entityId: 'quote-7' }),
    ).toBeNull();
  });

  it('returns null when there is no entity target', () => {
    expect(resolveNotificationLink(base)).toBeNull();
    expect(resolveNotificationLink({ ...base, entityType: 'RFQ', entityId: null })).toBeNull();
  });
});
