vi.mock('@forethread/auth', () => ({
  createAuthStore: vi.fn(() => vi.fn()),
}));

import { createAuthStore } from '@forethread/auth';

import { useAuthStore } from './auth.store';

describe('auth.store', () => {
  it('creates auth store with correct key', () => {
    expect(createAuthStore).toHaveBeenCalledWith('forethread-company-auth');
  });

  it('exports useAuthStore', () => {
    expect(useAuthStore).toBeDefined();
  });
});
