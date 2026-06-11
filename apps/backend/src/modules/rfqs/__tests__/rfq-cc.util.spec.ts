import { normalizeCcEmails } from '../rfq-cc.util';

describe('normalizeCcEmails', () => {
  it('returns an empty array for undefined / null / empty input', () => {
    expect(normalizeCcEmails(undefined)).toEqual([]);
    expect(normalizeCcEmails(null)).toEqual([]);
    expect(normalizeCcEmails([])).toEqual([]);
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeCcEmails(['  buyer@acme.com  '])).toEqual(['buyer@acme.com']);
  });

  it('lower-cases addresses', () => {
    expect(normalizeCcEmails(['Buyer@Acme.COM'])).toEqual(['buyer@acme.com']);
  });

  it('de-duplicates case-insensitively, preserving first-seen order', () => {
    expect(normalizeCcEmails(['b@acme.com', 'a@acme.com', 'B@ACME.COM', '  a@acme.com '])).toEqual([
      'b@acme.com',
      'a@acme.com',
    ]);
  });

  it('drops blanks and entries without an @', () => {
    expect(normalizeCcEmails(['', '   ', 'not-an-email', 'ok@acme.com'])).toEqual(['ok@acme.com']);
  });

  it('ignores non-string entries defensively', () => {
    expect(normalizeCcEmails(['ok@acme.com', undefined as never, 42 as never])).toEqual([
      'ok@acme.com',
    ]);
  });
});
