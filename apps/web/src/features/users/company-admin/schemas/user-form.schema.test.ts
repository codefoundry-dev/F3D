vi.mock('@forethread/shared-types/client', () => ({
  UserRole: {
    COMPANY_ADMIN: 'COMPANY_ADMIN',
    PROCUREMENT_OFFICER: 'PROCUREMENT_OFFICER',
    FINANCIAL_OFFICER: 'FINANCIAL_OFFICER',
    Foreman: 'FOREMAN',
    WAREHOUSE_OFFICER: 'WAREHOUSE_OFFICER',
  },
}));

import { createUserFormSchema, editUserFormSchema } from './user-form.schema';

describe('createUserFormSchema', () => {
  it('validates correct data', () => {
    const result = createUserFormSchema.safeParse({
      name: 'John Doe',
      email: 'john@test.com',
      role: 'COMPANY_ADMIN',
      position: 'Manager',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createUserFormSchema.safeParse({
      name: '',
      email: 'john@test.com',
      role: 'COMPANY_ADMIN',
      position: 'Manager',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = createUserFormSchema.safeParse({
      name: 'John',
      email: 'invalid',
      role: 'COMPANY_ADMIN',
      position: 'Manager',
    });
    expect(result.success).toBe(false);
  });

  it('allows empty position (position is optional per design + DTO)', () => {
    const result = createUserFormSchema.safeParse({
      name: 'John',
      email: 'john@test.com',
      role: 'COMPANY_ADMIN',
      position: '',
    });
    expect(result.success).toBe(true);
  });

  it('allows omitted position', () => {
    const result = createUserFormSchema.safeParse({
      name: 'John',
      email: 'john@test.com',
      role: 'COMPANY_ADMIN',
    });
    expect(result.success).toBe(true);
  });
});

describe('editUserFormSchema', () => {
  it('validates correct data', () => {
    const result = editUserFormSchema.safeParse({
      name: 'John Doe',
      email: 'john@test.com',
      phone: '+123',
      role: 'COMPANY_ADMIN',
      position: 'Manager',
      department: 'IT',
    });
    expect(result.success).toBe(true);
  });

  it('allows optional fields to be empty strings', () => {
    const result = editUserFormSchema.safeParse({
      name: 'John',
      email: 'john@test.com',
      phone: '',
      role: 'COMPANY_ADMIN',
      position: '',
      department: '',
    });
    expect(result.success).toBe(true);
  });
});
