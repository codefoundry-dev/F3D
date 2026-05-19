import { renderHook, act } from '@testing-library/react';

import { useBulkOrderSort } from './useBulkOrderSort';

describe('useBulkOrderSort', () => {
  it('starts with empty sortBy and asc direction', () => {
    const { result } = renderHook(() => useBulkOrderSort());
    expect(result.current.sortBy).toBe('');
    expect(result.current.sortDir).toBe('asc');
  });

  it('sets sortBy and asc when sorting a new field', () => {
    const { result } = renderHook(() => useBulkOrderSort());
    act(() => {
      result.current.handleSort('name');
    });
    expect(result.current.sortBy).toBe('name');
    expect(result.current.sortDir).toBe('asc');
  });

  it('toggles to desc when sorting same field', () => {
    const { result } = renderHook(() => useBulkOrderSort());
    act(() => {
      result.current.handleSort('name');
    });
    act(() => {
      result.current.handleSort('name');
    });
    expect(result.current.sortBy).toBe('name');
    expect(result.current.sortDir).toBe('desc');
  });

  it('toggles back to asc on third click', () => {
    const { result } = renderHook(() => useBulkOrderSort());
    act(() => {
      result.current.handleSort('name');
    });
    act(() => {
      result.current.handleSort('name');
    });
    act(() => {
      result.current.handleSort('name');
    });
    expect(result.current.sortDir).toBe('asc');
  });

  it('resets to asc when switching to different field', () => {
    const { result } = renderHook(() => useBulkOrderSort());
    act(() => {
      result.current.handleSort('name');
    });
    act(() => {
      result.current.handleSort('name');
    });
    act(() => {
      result.current.handleSort('date');
    });
    expect(result.current.sortBy).toBe('date');
    expect(result.current.sortDir).toBe('asc');
  });
});
