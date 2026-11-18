import { availBelowRequested, quotedQty } from './quoteQty';

const base = { included: true, requestedQty: 100 };

describe('availBelowRequested', () => {
  it('flags an available quantity below the required quantity', () => {
    expect(availBelowRequested({ ...base, availQty: '99' })).toBe(true);
    expect(availBelowRequested({ ...base, availQty: '99.5' })).toBe(true);
  });

  it('does not flag an equal or larger available quantity', () => {
    expect(availBelowRequested({ ...base, availQty: '100' })).toBe(false);
    expect(availBelowRequested({ ...base, availQty: '250' })).toBe(false);
  });

  it('ignores blank and excluded lines', () => {
    expect(availBelowRequested({ ...base, availQty: '' })).toBe(false);
    expect(availBelowRequested({ ...base, availQty: '   ' })).toBe(false);
    expect(availBelowRequested({ included: false, availQty: '5', requestedQty: 100 })).toBe(false);
  });
});

describe('quotedQty', () => {
  it('prices the required quantity when more is available', () => {
    expect(quotedQty({ availQty: '8', requestedQty: 7 })).toBe(7);
  });

  it('prices the available quantity when it is below the required one', () => {
    expect(quotedQty({ availQty: '5', requestedQty: 7 })).toBe(5);
  });

  it('is zero for a blank quantity', () => {
    expect(quotedQty({ availQty: '', requestedQty: 7 })).toBe(0);
  });
});
