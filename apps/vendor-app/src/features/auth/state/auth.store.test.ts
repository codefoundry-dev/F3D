vi.mock('@forethread/auth', () => ({
  createAuthStore: vi.fn(() => vi.fn()),
}));

import { useAuthStore } from './auth.store';

describe('auth.store', () => {
  it('exports useAuthStore as a function', () => {
    expect(useAuthStore).toBeDefined();
    expect(typeof useAuthStore).toBe('function');
  });
});
