import { describe, expect, it } from 'vitest';

import { applyNeedByDefault, trackNeedByOverrides, type NeedByLine } from './lineNeedBy';

const header = { date: '2026-12-01', time: '08:00' };

describe('applyNeedByDefault', () => {
  it('fills every line that has not been overridden', () => {
    const lines: NeedByLine[] = [{ key: 'a' }, { key: 'b', expectedDeliveryDate: '2026-11-01' }];
    expect(applyNeedByDefault(lines, header)).toEqual([
      { key: 'a', expectedDeliveryDate: '2026-12-01', deliveryTime: '08:00' },
      { key: 'b', expectedDeliveryDate: '2026-12-01', deliveryTime: '08:00' },
    ]);
  });

  it('leaves overridden fields alone, per field', () => {
    const lines: NeedByLine[] = [
      { key: 'a', expectedDeliveryDate: '2026-12-05', needByDateOverridden: true },
      { key: 'b', deliveryTime: '14:00', needByTimeOverridden: true },
    ];
    expect(applyNeedByDefault(lines, header)).toEqual([
      {
        key: 'a',
        expectedDeliveryDate: '2026-12-05',
        deliveryTime: '08:00',
        needByDateOverridden: true,
      },
      {
        key: 'b',
        expectedDeliveryDate: '2026-12-01',
        deliveryTime: '14:00',
        needByTimeOverridden: true,
      },
    ]);
  });

  it('clears following lines when the header is cleared', () => {
    const lines: NeedByLine[] = [
      { key: 'a', expectedDeliveryDate: '2026-12-01', deliveryTime: '08:00' },
    ];
    expect(applyNeedByDefault(lines, { date: '', time: '' })).toEqual([
      { key: 'a', expectedDeliveryDate: undefined, deliveryTime: undefined },
    ]);
  });

  it('returns the same array when nothing changes (safe inside an effect)', () => {
    const lines: NeedByLine[] = [
      { key: 'a', expectedDeliveryDate: '2026-12-01', deliveryTime: '08:00' },
      {
        key: 'b',
        expectedDeliveryDate: '2026-12-09',
        needByDateOverridden: true,
        deliveryTime: '08:00',
      },
    ];
    expect(applyNeedByDefault(lines, header)).toBe(lines);
    expect(applyNeedByDefault([{ key: 'c' }], { date: '', time: '' })).toEqual([{ key: 'c' }]);
  });
});

describe('trackNeedByOverrides', () => {
  const prev: NeedByLine[] = [
    { key: 'a', expectedDeliveryDate: '2026-12-01', deliveryTime: '08:00' },
    { key: 'b', expectedDeliveryDate: '2026-12-01', deliveryTime: '08:00' },
  ];

  it('marks a hand-changed date as overridden, leaving the time following', () => {
    const next = [{ ...prev[0], expectedDeliveryDate: '2026-12-05' }, prev[1]];
    const result = trackNeedByOverrides(prev, next, header);
    expect(result[0]).toMatchObject({ needByDateOverridden: true });
    expect(result[0].needByTimeOverridden).toBeUndefined();
    expect(result[1]).toBe(prev[1]);
  });

  it('treats clearing a line as an override', () => {
    const next = [{ ...prev[0], deliveryTime: undefined }, prev[1]];
    expect(trackNeedByOverrides(prev, next, header)[0]).toMatchObject({
      needByTimeOverridden: true,
    });
  });

  it('setting a line back to the header value makes it follow again', () => {
    const overridden = [
      { ...prev[0], expectedDeliveryDate: '2026-12-05', needByDateOverridden: true },
    ];
    const next = [{ ...overridden[0], expectedDeliveryDate: '2026-12-01' }];
    expect(trackNeedByOverrides(overridden, next, header)[0]).toMatchObject({
      needByDateOverridden: false,
    });
  });

  it('leaves new lines and unrelated edits untouched', () => {
    const added: NeedByLine = { key: 'c' };
    const next = [{ ...prev[0], notes: 'x' } as NeedByLine, prev[1], added];
    const result = trackNeedByOverrides(prev, next, header);
    expect(result[0].needByDateOverridden).toBeUndefined();
    expect(result[2]).toBe(added);
  });
});
