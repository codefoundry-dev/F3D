import { renderHook, act } from '@testing-library/react';

import { useVendorUserSort } from './useVendorUserSort';

describe('useVendorUserSort', () => {
  it('starts with null sort', () => {
    const { result } = renderHook(() => useVendorUserSort());
    expect(result.current.sortField).toBeNull();
    expect(result.current.sortDir).toBeNull();
  });

  it('sets asc on first click', () => {
    const { result } = renderHook(() => useVendorUserSort());
    act(() => result.current.handleSort('name'));
    expect(result.current.sortField).toBe('name');
    expect(result.current.sortDir).toBe('asc');
  });

  it('toggles to desc on second click of same field', () => {
    const { result } = renderHook(() => useVendorUserSort());
    act(() => result.current.handleSort('name'));
    act(() => result.current.handleSort('name'));
    expect(result.current.sortField).toBe('name');
    expect(result.current.sortDir).toBe('desc');
  });

  it('clears sort on third click of same field', () => {
    const { result } = renderHook(() => useVendorUserSort());
    act(() => result.current.handleSort('name'));
    act(() => result.current.handleSort('name'));
    act(() => result.current.handleSort('name'));
    expect(result.current.sortField).toBeNull();
    expect(result.current.sortDir).toBeNull();
  });

  it('resets to asc when switching fields', () => {
    const { result } = renderHook(() => useVendorUserSort());
    act(() => result.current.handleSort('name'));
    act(() => result.current.handleSort('name'));
    act(() => result.current.handleSort('email'));
    expect(result.current.sortField).toBe('email');
    expect(result.current.sortDir).toBe('asc');
  });
});
