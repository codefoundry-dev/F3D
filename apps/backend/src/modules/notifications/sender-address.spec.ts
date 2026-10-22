import { withSenderDisplayName } from './sender-address';

describe('withSenderDisplayName (FOR-383)', () => {
  it('wraps a bare configured address with "{company} via Forethread"', () => {
    expect(withSenderDisplayName('notifications@updates.forethread.com', 'Acme Builders')).toBe(
      '"Acme Builders via Forethread" <notifications@updates.forethread.com>',
    );
  });

  it('replaces an existing display name but keeps the configured address', () => {
    expect(withSenderDisplayName('Forethread <noreply@forethread.com>', 'Acme')).toBe(
      '"Acme via Forethread" <noreply@forethread.com>',
    );
  });

  it('returns the configured sender untouched without a company name', () => {
    expect(withSenderDisplayName('noreply@forethread.com')).toBe('noreply@forethread.com');
    expect(withSenderDisplayName('noreply@forethread.com', '   ')).toBe('noreply@forethread.com');
  });

  it('strips characters that could break or inject into the header', () => {
    expect(withSenderDisplayName('a@b.com', 'Evil"Co <x@y.com>\r\nBcc: z@z.com')).toBe(
      '"EvilCo x@y.com Bcc: z@z.com via Forethread" <a@b.com>',
    );
  });

  it('caps very long company names', () => {
    const from = withSenderDisplayName('a@b.com', 'A'.repeat(200));
    expect(from).toBe(`"${'A'.repeat(64)} via Forethread" <a@b.com>`);
  });
});
