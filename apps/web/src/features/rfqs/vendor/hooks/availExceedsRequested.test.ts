import { availExceedsRequested } from './availExceedsRequested';

const base = { included: true, availQty: '0', requestedQty: 100 };

describe('availExceedsRequested (FOR-273)', () => {
  it('accepts available quantity equal to required quantity', () => {
    expect(availExceedsRequested({ ...base, availQty: '100' })).toBe(false);
  });

  it('accepts available quantity less than required quantity', () => {
    expect(availExceedsRequested({ ...base, availQty: '99' })).toBe(false);
  });

  it('rejects available quantity greater than required quantity', () => {
    expect(availExceedsRequested({ ...base, availQty: '101' })).toBe(true);
  });

  it('treats a blank available quantity as not exceeding', () => {
    expect(availExceedsRequested({ ...base, availQty: '' })).toBe(false);
    expect(availExceedsRequested({ ...base, availQty: '   ' })).toBe(false);
  });

  it('ignores excluded lines', () => {
    expect(availExceedsRequested({ included: false, availQty: '500', requestedQty: 100 })).toBe(
      false,
    );
  });

  it('handles decimal quantities', () => {
    expect(availExceedsRequested({ ...base, availQty: '100.5' })).toBe(true);
  });
});
