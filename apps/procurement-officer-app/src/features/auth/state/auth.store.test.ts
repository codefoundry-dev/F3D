vi.mock('@forethread/auth', () => ({
  createAuthStore: vi.fn(() => vi.fn(() => ({ isAuthenticated: false }))),
}));

import { createAuthStore } from '@forethread/auth';

import { useAuthStore } from './auth.store';

describe('auth.store', () => {
  it('creates store with correct key', () => {
    expect(createAuthStore).toHaveBeenCalledWith('forethread-procurement-officer-auth');
  });

  it('exports useAuthStore', () => {
    expect(useAuthStore).toBeDefined();
  });
});
