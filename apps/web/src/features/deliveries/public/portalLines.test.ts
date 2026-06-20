import { DamageDisposition, DamageType, DeliveryOutcome } from '@forethread/shared-types/client';
import type { DeliveryPortalLine } from '@forethread/shared-types/client';
import { describe, it, expect } from 'vitest';

import {
  isPortalLineValid,
  portalLineToInput,
  portalPoLineToDraft,
  resolveOutcome,
  summarisePortalLines,
  type PortalLineDraft,
} from './portalLines';

function portalLine(overrides: Partial<DeliveryPortalLine> = {}): DeliveryPortalLine {
  return {
    id: 'li-1',
    lineItemRef: 'STL-6M-002',
    materialName: 'Steel Beams 6m',
    description: '12ft',
    uom: 'pcs',
    quantityOrdered: 10,
    ...overrides,
  };
}

function draft(overrides: Partial<PortalLineDraft> = {}): PortalLineDraft {
  return { ...portalPoLineToDraft(portalLine()), ...overrides };
}

describe('portalLines', () => {
  describe('portalPoLineToDraft', () => {
    it('pre-fills delivered qty to the ordered quantity with no explicit status', () => {
      const d = portalPoLineToDraft(portalLine({ quantityOrdered: 50 }));
      expect(d.quantityReceived).toBe('50');
      expect(d.status).toBeNull();
      expect(d.photos).toEqual([]);
    });
  });

  describe('resolveOutcome', () => {
    it('is DELIVERED when full quantity received and no status', () => {
      expect(resolveOutcome(draft({ quantityReceived: '10' }))).toBe(DeliveryOutcome.DELIVERED);
    });

    it('derives PARTIALLY_DELIVERED when received is between 0 and ordered', () => {
      expect(resolveOutcome(draft({ quantityReceived: '4' }))).toBe(
        DeliveryOutcome.PARTIALLY_DELIVERED,
      );
    });

    it('derives NOT_DELIVERED when received is zero', () => {
      expect(resolveOutcome(draft({ quantityReceived: '0' }))).toBe(DeliveryOutcome.NOT_DELIVERED);
    });

    it('an explicit status wins over the derived outcome', () => {
      expect(resolveOutcome(draft({ quantityReceived: '10', status: 'DAMAGED' }))).toBe(
        DeliveryOutcome.DAMAGED,
      );
      expect(resolveOutcome(draft({ quantityReceived: '10', status: 'REJECTED' }))).toBe(
        DeliveryOutcome.REJECTED,
      );
      expect(resolveOutcome(draft({ quantityReceived: '10', status: 'NOT_DELIVERED' }))).toBe(
        DeliveryOutcome.NOT_DELIVERED,
      );
    });
  });

  describe('portalLineToInput', () => {
    it('maps a delivered line to its received quantity', () => {
      expect(portalLineToInput(draft({ quantityReceived: '10' }))).toEqual({
        poLineItemId: 'li-1',
        quantityReceived: 10,
        outcome: DeliveryOutcome.DELIVERED,
      });
    });

    it('zeroes the received quantity for NOT_DELIVERED and REJECTED', () => {
      expect(portalLineToInput(draft({ quantityReceived: '10', status: 'NOT_DELIVERED' }))).toEqual(
        {
          poLineItemId: 'li-1',
          quantityReceived: 0,
          outcome: DeliveryOutcome.NOT_DELIVERED,
        },
      );
      expect(portalLineToInput(draft({ quantityReceived: '10', status: 'REJECTED' }))).toEqual({
        poLineItemId: 'li-1',
        quantityReceived: 0,
        outcome: DeliveryOutcome.REJECTED,
      });
    });

    it('carries the damage details (qty + type + disposition) when DAMAGED', () => {
      const input = portalLineToInput(
        draft({
          quantityReceived: '8',
          status: 'DAMAGED',
          damagedQuantity: '3',
          damageType: DamageType.WATER,
          damageDisposition: DamageDisposition.RETURNED,
        }),
      );
      expect(input).toEqual({
        poLineItemId: 'li-1',
        quantityReceived: 8,
        outcome: DeliveryOutcome.DAMAGED,
        damagedQuantity: 3,
        damageType: DamageType.WATER,
        damageDisposition: DamageDisposition.RETURNED,
      });
    });
  });

  describe('isPortalLineValid', () => {
    it('accepts a plain delivered line', () => {
      expect(isPortalLineValid(draft({ quantityReceived: '10' }))).toBe(true);
    });

    it('rejects a non-integer / negative / empty received quantity', () => {
      expect(isPortalLineValid(draft({ quantityReceived: '' }))).toBe(false);
      expect(isPortalLineValid(draft({ quantityReceived: '1.5' }))).toBe(false);
      expect(isPortalLineValid(draft({ quantityReceived: '-1' }))).toBe(false);
    });

    it('requires the full damage sub-form when DAMAGED', () => {
      const base = draft({ quantityReceived: '8', status: 'DAMAGED' });
      // Missing damaged qty / type / disposition → invalid.
      expect(isPortalLineValid({ ...base, damagedQuantity: '0' })).toBe(false);
      expect(
        isPortalLineValid({
          ...base,
          damagedQuantity: '2',
          damageType: '',
          damageDisposition: null,
        }),
      ).toBe(false);
      // Fully specified → valid.
      expect(
        isPortalLineValid({
          ...base,
          damagedQuantity: '2',
          damageType: DamageType.PACKAGING,
          damageDisposition: DamageDisposition.ACCEPTED,
        }),
      ).toBe(true);
    });
  });

  describe('summarisePortalLines', () => {
    it('tallies lines by their resolved outcome', () => {
      const lines: PortalLineDraft[] = [
        draft({ id: 'a', quantityReceived: '10' }), // DELIVERED
        draft({ id: 'b', quantityReceived: '4' }), // PARTIALLY_DELIVERED
        draft({ id: 'c', quantityReceived: '0' }), // NOT_DELIVERED (derived)
        draft({ id: 'd', quantityReceived: '10', status: 'NOT_DELIVERED' }),
        draft({
          id: 'e',
          quantityReceived: '6',
          status: 'DAMAGED',
          damagedQuantity: '2',
          damageType: DamageType.OTHER,
          damageDisposition: DamageDisposition.ACCEPTED,
        }),
        draft({ id: 'f', quantityReceived: '10', status: 'REJECTED' }),
      ];
      expect(summarisePortalLines(lines)).toEqual({
        delivered: 1,
        partialDelivered: 1,
        notDelivered: 2,
        damage: 1,
        rejected: 1,
      });
    });
  });
});
