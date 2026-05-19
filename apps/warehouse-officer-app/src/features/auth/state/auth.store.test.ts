import { describe, it, expect, vi } from 'vitest';

const mockCreateAuthStore = vi.fn(() => vi.fn());

vi.mock('@forethread/auth', () => ({
  createAuthStore: mockCreateAuthStore,
}));

describe('auth.store', () => {
  it('creates auth store with correct storage key', async () => {
    await import('./auth.store');

    expect(mockCreateAuthStore).toHaveBeenCalledWith('forethread-warehouse-officer-auth');
  });

  it('exports useAuthStore', async () => {
    const { useAuthStore } = await import('./auth.store');

    expect(useAuthStore).toBeDefined();
  });
});
