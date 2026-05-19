import { getMyAvatarUrl } from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

import { useAvatarUrl } from './profile.service';

vi.mock('@forethread/api-client', () => ({
  getMyAvatarUrl: vi
    .fn()
    .mockResolvedValue({ url: 'http://localhost:9000/forethread-dev/avatars/user-1/photo.jpg' }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('profile.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useAvatarUrl', () => {
    it('fetches avatar URL via getMyAvatarUrl', async () => {
      const { result } = renderHook(() => useAvatarUrl(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(getMyAvatarUrl).toHaveBeenCalled();
    });

    it('returns the URL from the response', async () => {
      const { result } = renderHook(() => useAvatarUrl(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBe(
        'http://localhost:9000/forethread-dev/avatars/user-1/photo.jpg',
      );
    });
  });
});
