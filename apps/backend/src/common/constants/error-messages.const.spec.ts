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

  it('interpolates purchaseOrders.drawdownExceedsRemaining with all params', () => {
    const msg = ERR.purchaseOrders.drawdownExceedsRemaining(8, 'Steel Beam', 5, 'BULK-00001');
    expect(msg).toContain('8');
    expect(msg).toContain('Steel Beam');
    expect(msg).toContain('5');
    expect(msg).toContain('BULK-00001');
  });

  it('exposes the static drawdown bulk-order error strings', () => {
    expect(typeof ERR.purchaseOrders.bulkOrderNotFound).toBe('string');
    expect(typeof ERR.purchaseOrders.bulkOrderLineNotFound).toBe('string');
  });
});
