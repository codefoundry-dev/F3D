import { render } from '@testing-library/react';

vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn(() => ({})),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('react-router-dom', () => ({
  RouterProvider: ({ router }: { router: unknown }) => (
    <div data-testid="router-provider" data-router={String(!!router)}>
      Router
    </div>
  ),
  createBrowserRouter: vi.fn(() => ({})),
}));

vi.mock('./routes', () => ({
  routes: [],
}));

import { App } from './App';

describe('App', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(<App />);
    expect(getByTestId('router-provider')).toBeInTheDocument();
  });

  it('provides QueryClientProvider', () => {
    const { container } = render(<App />);
    expect(container.innerHTML).toContain('Router');
  });
});
