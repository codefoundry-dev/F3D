import { resolveSelectedRecipients, resolveVendorEmailRecipients } from './vendor-recipients.util';

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

describe('resolveSelectedRecipients', () => {
  it('emails only the selected reps when any are chosen', () => {
    expect(
      resolveSelectedRecipients(
        [{ email: 'jane@vendor.com' }, { email: 'john@vendor.com' }],
        [{ email: 'someone-else@vendor.com' }],
        'contact@vendor.com',
      ),
    ).toEqual(['jane@vendor.com', 'john@vendor.com']);
  });

  it('de-duplicates the selected reps case-insensitively', () => {
    expect(
      resolveSelectedRecipients([{ email: 'Jane@Vendor.com' }, { email: 'jane@vendor.com' }], []),
    ).toEqual(['Jane@Vendor.com']);
  });

  it('falls back to the vendor users when no reps were chosen', () => {
    expect(
      resolveSelectedRecipients([], [{ email: 'user@vendor.com' }], 'contact@vendor.com'),
    ).toEqual(['user@vendor.com']);
  });

  it('falls back to the company contact email when there are no reps or users', () => {
    expect(resolveSelectedRecipients([], [], 'contact@vendor.com')).toEqual(['contact@vendor.com']);
  });

  it('ignores blank selected rep emails and falls back', () => {
    expect(resolveSelectedRecipients([{ email: '  ' }], [{ email: 'user@vendor.com' }])).toEqual([
      'user@vendor.com',
    ]);
  });
});
