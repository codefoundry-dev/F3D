import { UserRole } from '@forethread/shared-types/client';
import { renderHook } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('useRoleOptions', () => {
  it('returns 6 options (all roles minus SuperAdmin)', async () => {
    const { useRoleOptions } = await import('./useRoleOptions');
    const { result } = renderHook(() => useRoleOptions());

    expect(result.current).toHaveLength(6);
  });

  it('does not include SuperAdmin', async () => {
    const { useRoleOptions } = await import('./useRoleOptions');
    const { result } = renderHook(() => useRoleOptions());

    const values = result.current.map((opt) => opt.value);
    expect(values).not.toContain(UserRole.SUPER_ADMIN);
  });

  it('each option has value and label properties', async () => {
    const { useRoleOptions } = await import('./useRoleOptions');
    const { result } = renderHook(() => useRoleOptions());

    for (const option of result.current) {
      expect(option).toHaveProperty('value');
      expect(option).toHaveProperty('label');
    }
  });

  it('labels are translation keys', async () => {
    const { useRoleOptions } = await import('./useRoleOptions');
    const { result } = renderHook(() => useRoleOptions());

    for (const option of result.current) {
      expect(option.label).toBe(`roles.${option.value}`);
    }
  });
});
