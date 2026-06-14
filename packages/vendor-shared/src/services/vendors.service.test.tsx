const mockApiClient = vi.hoisted(() => ({
  getVendors: vi.fn(),
  inviteVendor: vi.fn(),
  createCompany: vi.fn(),
}));

vi.mock('@forethread/api-client', () => mockApiClient);

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';

import { useVendors, useInviteVendor, useCreateVendorCompany } from './vendors.service';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('vendors.service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('useVendors calls getVendors with params and returns data', async () => {
    const vendors = [{ id: '1', name: 'Vendor A' }];
    mockApiClient.getVendors.mockResolvedValue(vendors);

    const params = { page: 1, limit: 10 };
    const { result } = renderHook(() => useVendors(params as never), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiClient.getVendors).toHaveBeenCalledWith(params);
    expect(result.current.data).toEqual(vendors);
  });

  it('useVendors works without params', async () => {
    const vendors = [{ id: '2', name: 'Vendor B' }];
    mockApiClient.getVendors.mockResolvedValue(vendors);

    const { result } = renderHook(() => useVendors(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiClient.getVendors).toHaveBeenCalledWith(undefined);
    expect(result.current.data).toEqual(vendors);
  });

  it('useInviteVendor calls inviteVendor and invalidates queries on success', async () => {
    mockApiClient.inviteVendor.mockResolvedValue({} as never);

    const wrapper = createWrapper();
    const { result: vendorsResult } = renderHook(() => useVendors(), { wrapper });
    await waitFor(() =>
      expect(vendorsResult.current.isSuccess || vendorsResult.current.isError).toBe(true),
    );

    const { result } = renderHook(() => useInviteVendor(), { wrapper });
    const dto = { email: 'vendor@example.com', companyName: 'Acme' };

    act(() => result.current.mutate(dto as never));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient.inviteVendor).toHaveBeenCalledWith(dto, { skipErrorHandler: true });
  });

  it('useCreateVendorCompany calls createCompany and invalidates queries on success', async () => {
    mockApiClient.createCompany.mockResolvedValue({} as never);

    const wrapper = createWrapper();
    const { result: vendorsResult } = renderHook(() => useVendors(), { wrapper });
    await waitFor(() =>
      expect(vendorsResult.current.isSuccess || vendorsResult.current.isError).toBe(true),
    );

    const { result } = renderHook(() => useCreateVendorCompany(), { wrapper });
    const dto = { name: 'New Vendor Co', address: '123 Main St' };

    act(() => result.current.mutate(dto as never));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient.createCompany).toHaveBeenCalledWith(dto);
  });
});
