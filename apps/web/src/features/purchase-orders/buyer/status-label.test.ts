import { i18n } from '@forethread/i18n';

import { buyerPoStatusKey } from './status-label';

/** Every PoStatus enum value the buyer UI can render (see purchase-order.prisma). */
const PO_STATUS_VALUES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SENT',
  'ACKNOWLEDGED',
  'ACCEPTED',
  'DECLINED',
  'SCHEDULED_FOR_DELIVERY',
  'CANCELLED',
  'CLOSED',
  'PARTIALLY_DELIVERED',
  'DELIVERED',
  'LATE_FOR_DELIVERY',
  'CANCELLED_BY_VENDOR',
  'INVOICED',
  'DISPUTE',
  'NOT_DELIVERED',
  'CHANGE_PENDING',
] as const;

const buyerLabel = (status: string): string =>
  i18n.t(`purchaseOrders:${buyerPoStatusKey(status)}` as never);

describe('buyerPoStatusKey', () => {
  it('namespaces the status under the buyerStatus block', () => {
    expect(buyerPoStatusKey('SENT')).toBe('buyerStatus.SENT');
    expect(buyerPoStatusKey('DRAFT')).toBe('buyerStatus.DRAFT');
  });

  it('keeps the raw enum value as the key (the buyer/vendor split lives in the namespace)', () => {
    expect(buyerPoStatusKey('CANCELLED_BY_VENDOR')).toBe('buyerStatus.CANCELLED_BY_VENDOR');
  });

  it('resolves the documented PO lifecycle vocabulary', () => {
    expect(buyerLabel('PENDING_APPROVAL')).toBe('Requested');
    expect(buyerLabel('SENT')).toBe('Ordered');
    expect(buyerLabel('ACKNOWLEDGED')).toBe('Confirmed');
    expect(buyerLabel('ACCEPTED')).toBe('Confirmed');
    expect(buyerLabel('SCHEDULED_FOR_DELIVERY')).toBe('Shipped');
    expect(buyerLabel('PARTIALLY_DELIVERED')).toBe('Partially Shipped');
    expect(buyerLabel('DELIVERED')).toBe('Delivered');
    expect(buyerLabel('CANCELLED')).toBe('Cancelled');
  });

  it('has a buyer label for every PoStatus value (no raw-key fallback)', () => {
    for (const status of PO_STATUS_VALUES) {
      const label = buyerLabel(status);
      expect(label).not.toContain('buyerStatus.');
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
