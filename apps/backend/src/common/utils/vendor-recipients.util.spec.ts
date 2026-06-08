import { resolveVendorEmailRecipients } from './vendor-recipients.util';

describe('resolveVendorEmailRecipients', () => {
  it('returns the vendor user emails when users exist', () => {
    expect(
      resolveVendorEmailRecipients(
        [{ email: 'a@vendor.com' }, { email: 'b@vendor.com' }],
        'contact@vendor.com',
      ),
    ).toEqual(['a@vendor.com', 'b@vendor.com']);
  });

  it('ignores the contact email whenever the vendor has at least one user', () => {
    expect(
      resolveVendorEmailRecipients([{ email: 'user@vendor.com' }], 'contact@vendor.com'),
    ).toEqual(['user@vendor.com']);
  });

  it('falls back to the contact email when the vendor has no users', () => {
    expect(resolveVendorEmailRecipients([], 'contact@vendor.com')).toEqual(['contact@vendor.com']);
  });

  it('falls back to the contact email when every user email is blank', () => {
    expect(resolveVendorEmailRecipients([{ email: '   ' }], 'contact@vendor.com')).toEqual([
      'contact@vendor.com',
    ]);
  });

  it('de-duplicates case-insensitively, preserving first-seen casing', () => {
    expect(
      resolveVendorEmailRecipients([{ email: 'Sales@Vendor.com' }, { email: 'sales@vendor.com' }]),
    ).toEqual(['Sales@Vendor.com']);
  });

  it('trims surrounding whitespace', () => {
    expect(resolveVendorEmailRecipients([{ email: '  user@vendor.com  ' }])).toEqual([
      'user@vendor.com',
    ]);
  });

  it('returns an empty array when there is nowhere to send', () => {
    expect(resolveVendorEmailRecipients([])).toEqual([]);
    expect(resolveVendorEmailRecipients([{ email: '' }], null)).toEqual([]);
    expect(resolveVendorEmailRecipients([], undefined)).toEqual([]);
  });
});
