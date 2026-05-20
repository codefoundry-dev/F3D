import { renderHook } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/shared-types/client', () => ({
  UserRole: {
    COMPANY_ADMIN: 'COMPANY_ADMIN',
    PROCUREMENT_OFFICER: 'PROCUREMENT_OFFICER',
    FINANCIAL_OFFICER: 'FINANCIAL_OFFICER',
    FOREMAN: 'FOREMAN',
    WAREHOUSE_OFFICER: 'WAREHOUSE_OFFICER',
  },
}));

import { useRoleOptions } from './useRoleOptions';

describe('useRoleOptions', () => {
  it('returns 5 options (company roles)', () => {
    const { result } = renderHook(() => useRoleOptions());
    expect(result.current).toHaveLength(5);
  });

  it('each option has value and label properties', () => {
    const { result } = renderHook(() => useRoleOptions());
    result.current.forEach((opt) => {
      expect(opt.value).toBeDefined();
      expect(opt.label).toBeDefined();
    });
  });

  it('labels are translation keys', () => {
    const { result } = renderHook(() => useRoleOptions());
    result.current.forEach((opt) => {
      expect(opt.label).toMatch(/^roles\./);
    });
  });
});
