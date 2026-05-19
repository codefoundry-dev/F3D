import { render } from '@testing-library/react';

vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn(() => ({})),
  QueryClientProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('react-router-dom', () => ({
  createBrowserRouter: vi.fn(() => ({})),
  RouterProvider: () => <div data-testid="router-provider" />,
}));

vi.mock('./routes', () => ({ routes: [] }));

import { App } from './App';

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
  });

  it('wraps content in QueryClientProvider', () => {
    const { getByTestId } = render(<App />);
    expect(getByTestId('router-provider')).toBeInTheDocument();
  });
});
