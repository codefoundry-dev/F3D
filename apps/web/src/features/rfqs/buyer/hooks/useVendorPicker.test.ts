import { act, renderHook } from '@testing-library/react';

const mockUseAssignedVendors = vi.hoisted(() => vi.fn());
const mockResolve = vi.hoisted(() => vi.fn());

vi.mock('../services/rfqs.service', () => ({
  useAssignedVendors: mockUseAssignedVendors,
  useResolveVendorSelection: () => ({ mutate: mockResolve, isPending: false }),
}));

import { useVendorPicker } from './useVendorPicker';

const selection = { vendorIds: [], repIds: [] };

describe('useVendorPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAssignedVendors.mockReturnValue({ data: [], isLoading: false });
  });

  it("offers the RFQ projects' one-off vendors in the list and in Add All (FOR-395)", () => {
    const { result } = renderHook(() => useVendorPicker(selection, vi.fn(), ['p1', 'p2']));

    expect(mockUseAssignedVendors).toHaveBeenLastCalledWith({ projectIds: 'p1,p2' });

    act(() => result.current.addAll());
    expect(mockResolve.mock.calls[0][0]).toEqual({ projectIds: ['p1', 'p2'] });
  });

  it('asks for no one-offs before a project is chosen', () => {
    const { result } = renderHook(() => useVendorPicker(selection, vi.fn()));

    expect(mockUseAssignedVendors).toHaveBeenLastCalledWith({});
    act(() => result.current.addAll());
    expect(mockResolve.mock.calls[0][0]).toEqual({});
  });
});
