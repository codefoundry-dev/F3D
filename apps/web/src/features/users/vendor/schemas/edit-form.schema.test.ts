import { editVendorUserFormSchema } from './edit-form.schema';

describe('editVendorUserFormSchema', () => {
  it('validates valid input', () => {
    const result = editVendorUserFormSchema.safeParse({
      name: 'John',
      email: 'john@test.com',
      phone: '123',
      position: 'Dev',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = editVendorUserFormSchema.safeParse({ name: '', email: 'a@b.com' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = editVendorUserFormSchema.safeParse({ name: 'A', email: 'bad' });
    expect(result.success).toBe(false);
  });

  it('defaults phone and position to empty string', () => {
    const result = editVendorUserFormSchema.parse({ name: 'A', email: 'a@b.com' });
    expect(result.phone).toBe('');
    expect(result.position).toBe('');
  });
});
