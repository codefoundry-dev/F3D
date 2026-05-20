import { renderHook, act } from '@testing-library/react';

import { useProjectSort } from './useProjectSort';

describe('useProjectSort', () => {
  it('uses default sort field and direction', () => {
    const { result } = renderHook(() => useProjectSort());
    expect(result.current.sortBy).toBe('createdAt');
    expect(result.current.sortDir).toBe('desc');
  });

  it('accepts custom defaults', () => {
    const { result } = renderHook(() => useProjectSort('name', 'asc'));
    expect(result.current.sortBy).toBe('name');
    expect(result.current.sortDir).toBe('asc');
  });

  it('toggles direction when sorting same field', () => {
    const { result } = renderHook(() => useProjectSort('name', 'asc'));
    act(() => {
      result.current.handleSort('name');
    });
    expect(result.current.sortDir).toBe('desc');
  });

  it('sets new field to asc', () => {
    const { result } = renderHook(() => useProjectSort());
    act(() => {
      result.current.handleSort('name');
    });
    expect(result.current.sortBy).toBe('name');
    expect(result.current.sortDir).toBe('asc');
  });

  it('exposes setSortBy and setSortDir', () => {
    const { result } = renderHook(() => useProjectSort());
    act(() => {
      result.current.setSortBy('status');
    });
    expect(result.current.sortBy).toBe('status');
    act(() => {
      result.current.setSortDir('asc');
    });
    expect(result.current.sortDir).toBe('asc');
  });
});
