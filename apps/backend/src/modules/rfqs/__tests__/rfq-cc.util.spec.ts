import { collectProjectMemberEmails, normalizeCcEmails } from '../rfq-cc.util';

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

describe('collectProjectMemberEmails', () => {
  it('returns an empty array when no projects are present', () => {
    expect(collectProjectMemberEmails({})).toEqual([]);
    expect(collectProjectMemberEmails({ project: null, projects: null })).toEqual([]);
  });

  it('collects emails from the primary project members', () => {
    expect(
      collectProjectMemberEmails({
        project: {
          members: [{ user: { email: 'pm@acme.com' } }, { user: { email: 'lead@acme.com' } }],
        },
      }),
    ).toEqual(['pm@acme.com', 'lead@acme.com']);
  });

  it('collects emails from every project the RFQ spans', () => {
    expect(
      collectProjectMemberEmails({
        project: { members: [{ user: { email: 'primary@acme.com' } }] },
        projects: [
          { project: { members: [{ user: { email: 'primary@acme.com' } }] } },
          { project: { members: [{ user: { email: 'second@acme.com' } }] } },
        ],
      }),
    ).toEqual(['primary@acme.com', 'primary@acme.com', 'second@acme.com']);
  });

  it('skips members without an email', () => {
    expect(
      collectProjectMemberEmails({
        project: {
          members: [
            { user: { email: null } },
            { user: { email: '' } },
            { user: { email: 'has@acme.com' } },
          ],
        },
      }),
    ).toEqual(['has@acme.com']);
  });

  it('tolerates projects with no members', () => {
    expect(
      collectProjectMemberEmails({
        project: { members: null },
        projects: [{ project: { members: [] } }],
      }),
    ).toEqual([]);
  });
});
