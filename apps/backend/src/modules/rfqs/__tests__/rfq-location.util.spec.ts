import { formatRfqLocation } from '../rfq-location.util';

describe('formatRfqLocation', () => {
  it('shows label and address together', () => {
    expect(formatRfqLocation({ label: 'Main gate', address: '9 Dock Rd' })).toBe(
      'Main gate — 9 Dock Rd',
    );
  });

  it('falls back to whichever part is present', () => {
    expect(formatRfqLocation({ label: null, address: '9 Dock Rd' })).toBe('9 Dock Rd');
    expect(formatRfqLocation({ label: 'Main gate', address: '  ' })).toBe('Main gate');
  });

  it('does not repeat a label that equals the address', () => {
    expect(formatRfqLocation({ label: '9 Dock Rd', address: '9 Dock Rd' })).toBe('9 Dock Rd');
  });

  it('returns null for no location', () => {
    expect(formatRfqLocation(null)).toBeNull();
    expect(formatRfqLocation({ label: null, address: null })).toBeNull();
  });
});
