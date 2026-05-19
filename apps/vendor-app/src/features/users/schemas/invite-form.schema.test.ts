import { inviteVendorUserSchema } from './invite-form.schema';

describe('inviteVendorUserSchema', () => {
  it('validates a valid input', () => {
    const result = inviteVendorUserSchema.safeParse({
      name: 'John Doe',
      email: 'john@example.com',
      position: 'Manager',
    });
    expect(result.success).toBe(true);
  });

  it('requires name', () => {
    const result = inviteVendorUserSchema.safeParse({ name: '', email: 'a@b.com' });
    expect(result.success).toBe(false);
  });

  it('requires valid email', () => {
    const result = inviteVendorUserSchema.safeParse({ name: 'John', email: 'not-email' });
    expect(result.success).toBe(false);
  });

  it('defaults position to empty string', () => {
    const result = inviteVendorUserSchema.safeParse({ name: 'John', email: 'a@b.com' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.position).toBe('');
  });

  it('rejects name longer than 255 chars', () => {
    const result = inviteVendorUserSchema.safeParse({ name: 'a'.repeat(256), email: 'a@b.com' });
    expect(result.success).toBe(false);
  });
});
