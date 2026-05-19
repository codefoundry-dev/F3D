import { editCompanySchema } from './company-form.schema';

describe('editCompanySchema', () => {
  it('validates correct data', () => {
    const result = editCompanySchema.safeParse({
      legalName: 'Test Corp',
      tradeName: 'Test',
      abn: '12345678901',
      taxCode: '123456789',
      legalAddress: '123 Main St',
      contactEmail: 'test@test.com',
      contactPhone: '+61400000000',
      website: 'https://test.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty legal name', () => {
    const result = editCompanySchema.safeParse({ legalName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid ABN (not 11 digits)', () => {
    const result = editCompanySchema.safeParse({
      legalName: 'Test',
      abn: '123',
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty ABN', () => {
    const result = editCompanySchema.safeParse({
      legalName: 'Test',
      abn: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid tax code (non-digits)', () => {
    const result = editCompanySchema.safeParse({
      legalName: 'Test',
      taxCode: 'abc',
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty tax code', () => {
    const result = editCompanySchema.safeParse({
      legalName: 'Test',
      taxCode: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid contact email', () => {
    const result = editCompanySchema.safeParse({
      legalName: 'Test',
      contactEmail: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty contact email', () => {
    const result = editCompanySchema.safeParse({
      legalName: 'Test',
      contactEmail: '',
    });
    expect(result.success).toBe(true);
  });
});
