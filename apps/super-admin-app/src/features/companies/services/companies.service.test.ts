import { getCompanies, getCompany, createCompany, updateCompany } from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

import { useCompanies, useCompany, useCreateCompany, useUpdateCompany } from './companies.service';

vi.mock('@forethread/api-client', () => ({
  getCompanies: vi.fn().mockResolvedValue({ data: [{ id: 'c1', name: 'Acme' }], total: 1 }),
  getCompany: vi.fn().mockResolvedValue({ id: 'c1', name: 'Acme' }),
  createCompany: vi.fn().mockResolvedValue({ id: 'c2', name: 'Globex' }),
  updateCompany: vi.fn().mockResolvedValue({ id: 'c1', name: 'Updated' }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('companies.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useCompanies', () => {
    it('fetches company list via getCompanies', async () => {
      const { result } = renderHook(() => useCompanies(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(getCompanies).toHaveBeenCalledWith(undefined);
      expect(result.current.data).toEqual({ data: [{ id: 'c1', name: 'Acme' }], total: 1 });
    });

    it('passes params to getCompanies', async () => {
      const params = { search: 'acme' };
      const { result } = renderHook(() => useCompanies(params as any), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(getCompanies).toHaveBeenCalledWith(params);
    });
  });

  describe('useCompany', () => {
    it('fetches a single company by id', async () => {
      const { result } = renderHook(() => useCompany('c1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(getCompany).toHaveBeenCalledWith('c1');
      expect(result.current.data).toEqual({ id: 'c1', name: 'Acme' });
    });

    it('is disabled when id is empty', () => {
      const { result } = renderHook(() => useCompany(''), { wrapper: createWrapper() });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useCreateCompany', () => {
    it('calls createCompany and invalidates companies queries on success', async () => {
      const { result } = renderHook(() => useCreateCompany(), { wrapper: createWrapper() });

      const dto = { name: 'Globex', abn: '12345678901' };
      result.current.mutate(dto as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(createCompany).toHaveBeenCalledWith(dto);
    });
  });

  describe('useUpdateCompany', () => {
    it('calls updateCompany and invalidates companies and users queries on success', async () => {
      const { result } = renderHook(() => useUpdateCompany(), { wrapper: createWrapper() });

      const dto = { name: 'Updated' };
      result.current.mutate({ id: 'c1', dto } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(updateCompany).toHaveBeenCalledWith('c1', dto);
    });
  });
});
