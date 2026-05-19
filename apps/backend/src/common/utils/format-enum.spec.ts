import { formatEnum } from './format-enum';

describe('formatEnum', () => {
  it('returns empty string for null', () => {
    expect(formatEnum(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatEnum(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatEnum('')).toBe('');
  });

  it('converts PENDING_APPROVAL to Pending approval', () => {
    expect(formatEnum('PENDING_APPROVAL')).toBe('Pending approval');
  });

  it('converts HOLD_FOR_RELEASE to Hold for release', () => {
    expect(formatEnum('HOLD_FOR_RELEASE')).toBe('Hold for release');
  });

  it('converts NOT_REQUIRED to Not required', () => {
    expect(formatEnum('NOT_REQUIRED')).toBe('Not required');
  });

  it('converts single word ACTIVE', () => {
    expect(formatEnum('ACTIVE')).toBe('Active');
  });
});
