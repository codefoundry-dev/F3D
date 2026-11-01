import { Sidebar } from '@forethread/ui-components';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// FOR-358: the rail starts collapsed on 13–14" laptop widths unless the user has
// explicitly toggled it; an explicit choice always wins.
const KEY = 'sidebar-collapsed-v2';
const originalWidth = window.innerWidth;

function setWidth(px: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: px });
}

function renderSidebar() {
  return render(<Sidebar items={[]} onNavigate={() => {}} companyName="Forethread" />);
}

describe('Sidebar collapse default', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => setWidth(originalWidth));

  it('starts collapsed below 1280px when the user has never toggled it', () => {
    setWidth(1152);
    renderSidebar();
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    expect(screen.queryByText('Forethread')).not.toBeInTheDocument();
  });

  it('starts expanded at 1280px and wider', () => {
    setWidth(1440);
    renderSidebar();
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(screen.getByText('Forethread')).toBeInTheDocument();
  });

  it('does not persist the width-based default on mount', () => {
    setWidth(1152);
    renderSidebar();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('persists an explicit toggle and honours it on a narrow screen', () => {
    setWidth(1152);
    const { unmount } = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(localStorage.getItem(KEY)).toBe('false');
    unmount();

    renderSidebar();
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
  });

  it('honours an explicit collapse on a wide screen', () => {
    setWidth(1440);
    localStorage.setItem(KEY, 'true');
    renderSidebar();
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });
});
