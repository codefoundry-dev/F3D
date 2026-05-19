import { PERMISSION_KEYS } from './constants';

describe('PERMISSION_KEYS', () => {
  it('has exactly 3 keys', () => {
    expect(PERMISSION_KEYS).toHaveLength(3);
  });

  it('contains permissionRfq, permissionPo, permissionInventory', () => {
    expect(PERMISSION_KEYS).toContain('permissionRfq');
    expect(PERMISSION_KEYS).toContain('permissionPo');
    expect(PERMISSION_KEYS).toContain('permissionInventory');
  });

  it('all values are non-empty strings', () => {
    for (const key of PERMISSION_KEYS) {
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    }
  });
});
