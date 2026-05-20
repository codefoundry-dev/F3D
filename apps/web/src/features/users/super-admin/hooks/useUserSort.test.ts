import { renderHook, act } from '@testing-library/react';

import { useUserSort } from './useUserSort';

describe('useUserSort', () => {
  it('starts with null sortField and sortDir', () => {
    const { result } = renderHook(() => useUserSort());
    expect(result.current.sortField).toBeNull();
    expect(result.current.sortDir).toBeNull();
  });

  it('sets field to asc on first sort', () => {
    const { result } = renderHook(() => useUserSort());
    act(() => {
      result.current.handleSort('name');
    });
    expect(result.current.sortField).toBe('name');
    expect(result.current.sortDir).toBe('asc');
  });

  it('changes to desc when already asc', () => {
    const { result } = renderHook(() => useUserSort());
    act(() => {
      result.current.handleSort('name');
    });
    act(() => {
      result.current.handleSort('name');
    });
    expect(result.current.sortField).toBe('name');
    expect(result.current.sortDir).toBe('desc');
  });

  it('clears sort when already desc (3-state cycle)', () => {
    const { result } = renderHook(() => useUserSort());
    act(() => {
      result.current.handleSort('name');
    });
    act(() => {
      result.current.handleSort('name');
    });
    act(() => {
      result.current.handleSort('name');
    });
    expect(result.current.sortField).toBeNull();
    expect(result.current.sortDir).toBeNull();
  });

  it('resets to asc when switching fields', () => {
    const { result } = renderHook(() => useUserSort());
    act(() => {
      result.current.handleSort('name');
    });
    act(() => {
      result.current.handleSort('name');
    }); // desc
    act(() => {
      result.current.handleSort('email');
    }); // new field
    expect(result.current.sortField).toBe('email');
    expect(result.current.sortDir).toBe('asc');
  });
});
