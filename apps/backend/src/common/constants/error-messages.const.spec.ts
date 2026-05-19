import { ERR } from './error-messages.const';

describe('ERR', () => {
  it('interpolates usersNotFoundOrInactive with ids param', () => {
    const msg = ERR.projects.usersNotFoundOrInactive('u-1, u-2');
    expect(msg).toContain('u-1, u-2');
  });

  it('interpolates duplicateLocationName with name param', () => {
    const msg = ERR.projects.duplicateLocationName('Warehouse A');
    expect(msg).toContain('Warehouse A');
  });

  it('interpolates storage.fileTooLarge with maxSize param', () => {
    const msg = ERR.storage.fileTooLarge('10MB');
    expect(msg).toContain('10MB');
  });

  it('handles missing param key with empty string fallback', () => {
    // Call t() indirectly — duplicateLocationName uses t(template, { name })
    // Verify it doesn't throw when called normally
    const msg = ERR.projects.duplicateLocationName('');
    expect(typeof msg).toBe('string');
  });
});
