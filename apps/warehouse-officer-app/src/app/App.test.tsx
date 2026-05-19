import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn(() => ({})),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="query-provider">{children}</div>
  ),
}));

vi.mock('react-router-dom', () => ({
  RouterProvider: ({ router }: { router: unknown }) => (
    <div data-testid="router-provider">{router ? 'router-loaded' : 'no-router'}</div>
  ),
  createBrowserRouter: (routes: unknown[]) => routes,
}));

vi.mock('./routes', () => ({
  routes: [{ path: '/' }],
}));

import { App } from './App';

describe('App', () => {
  it('renders query provider and router provider', () => {
    render(<App />);
    expect(screen.getByTestId('query-provider')).toBeInTheDocument();
    expect(screen.getByTestId('router-provider')).toBeInTheDocument();
  });

  it('renders with router loaded', () => {
    render(<App />);
    expect(screen.getByText('router-loaded')).toBeInTheDocument();
  });
});
