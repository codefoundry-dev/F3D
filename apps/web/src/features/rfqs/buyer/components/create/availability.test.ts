import type { RfqAvailabilityResult } from '@forethread/api-client';
import { describe, expect, it } from 'vitest';

import {
  autoCoverAllocations,
  buildMatchIndex,
  remainingQty,
  type AllocationMap,
} from './availability';
import type { WizardLineItem } from './wizard-types';

const item: WizardLineItem = {
  key: 'li-a',
  source: 'CATALOG',
  materialName: 'Paint Primer White 5-Gal',
  quantity: 250,
  uom: 'gallons',
};

const availability: RfqAvailabilityResult = {
  vendors: [
    { vendorId: 'v1', vendorName: 'SteelCorp' },
    { vendorId: 'v2', vendorName: 'MetalWorks' },
  ],
  items: [
    {
      index: 0,
      matches: [
        // Two bulk orders from the same vendor — the larger one should win.
        {
          bulkOrderId: 'bo-1',
          bulkOrderNumber: 'BO-1',
          bulkOrderLineItemId: 'bol-small',
          vendorId: 'v1',
          qtyRemaining: 60,
          expirationDate: null,
          pricePerUnit: 10,
        },
        {
          bulkOrderId: 'bo-2',
          bulkOrderNumber: 'BO-2',
          bulkOrderLineItemId: 'bol-big',
          vendorId: 'v1',
          qtyRemaining: 300,
          expirationDate: '2026-12-31T00:00:00.000Z',
          pricePerUnit: 9,
        },
        {
          bulkOrderId: 'bo-3',
          bulkOrderNumber: 'BO-3',
          bulkOrderLineItemId: 'bol-v2',
          vendorId: 'v2',
          qtyRemaining: 45,
          expirationDate: null,
          pricePerUnit: 11,
        },
      ],
    },
  ],
};

describe('buildMatchIndex', () => {
  it('keeps the largest-remaining bulk line per vendor per row', () => {
    const index = buildMatchIndex(availability);
    expect(index.get(0)?.get('v1')).toMatchObject({
      bulkOrderLineItemId: 'bol-big',
      qtyRemaining: 300,
    });
    expect(index.get(0)?.get('v2')).toMatchObject({
      bulkOrderLineItemId: 'bol-v2',
      qtyRemaining: 45,
    });
  });

  it('returns an empty index without availability data', () => {
    expect(buildMatchIndex(undefined).size).toBe(0);
  });
});

describe('remainingQty', () => {
  it('returns the full quantity with no allocations', () => {
    expect(remainingQty(item, new Map())).toBe(250);
  });

  it('subtracts allocations across vendors, clamping at zero', () => {
    const allocations: AllocationMap = new Map([
      [
        'li-a',
        new Map([
          [
            'v1',
            { lineKey: 'li-a', vendorId: 'v1', bulkOrderLineItemId: 'bol-big', quantity: 200 },
          ],
          ['v2', { lineKey: 'li-a', vendorId: 'v2', bulkOrderLineItemId: 'bol-v2', quantity: 45 }],
        ]),
      ],
    ]);
    expect(remainingQty(item, allocations)).toBe(5);

    const over: AllocationMap = new Map([
      [
        'li-a',
        new Map([
          [
            'v1',
            { lineKey: 'li-a', vendorId: 'v1', bulkOrderLineItemId: 'bol-big', quantity: 300 },
          ],
        ]),
      ],
    ]);
    expect(remainingQty(item, over)).toBe(0);
  });
});

describe('autoCoverAllocations', () => {
  it('covers a line fully from its single best vendor', () => {
    // qty 250 ≤ v1's 300 → one allocation against the larger bulk line.
    const allocations = autoCoverAllocations([item], availability);
    const line = allocations.get('li-a');
    expect(line?.size).toBe(1);
    expect(line?.get('v1')).toMatchObject({ bulkOrderLineItemId: 'bol-big', quantity: 250 });
    expect(remainingQty(item, allocations)).toBe(0);
  });

  it('spills over to the next vendor when the best one cannot fully cover', () => {
    const big = { ...item, quantity: 320 };
    const allocations = autoCoverAllocations([big], availability);
    expect(allocations.get('li-a')?.get('v1')?.quantity).toBe(300);
    expect(allocations.get('li-a')?.get('v2')?.quantity).toBe(20);
    expect(remainingQty(big, allocations)).toBe(0);
  });

  it('covers only what capacity allows, leaving the rest uncovered', () => {
    const huge = { ...item, quantity: 400 };
    const allocations = autoCoverAllocations([huge], availability);
    // 300 (v1) + 45 (v2) = 345 covered, 55 left to quote out.
    expect(remainingQty(huge, allocations)).toBe(55);
  });

  it('returns an empty map without availability data', () => {
    expect(autoCoverAllocations([item], undefined).size).toBe(0);
  });
});
