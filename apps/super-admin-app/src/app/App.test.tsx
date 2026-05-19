import { render } from '@testing-library/react';

vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn(() => ({})),
  QueryClientProvider: ({ children }: any) => <div data-testid="query-provider">{children}</div>,
}));

vi.mock('react-router-dom', () => ({
  createBrowserRouter: vi.fn(() => ({})),
  RouterProvider: ({ router: _router }: any) => <div data-testid="router-provider" />,
}));

vi.mock('./routes', () => ({
  routes: [],
}));

import { App } from './App';

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });

  it('wraps content in QueryClientProvider', () => {
    const { getByTestId } = render(<App />);
    expect(getByTestId('query-provider')).toBeInTheDocument();
  });

  it('renders RouterProvider', () => {
    const { getByTestId } = render(<App />);
    expect(getByTestId('router-provider')).toBeInTheDocument();
  });
});
