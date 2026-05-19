import { render, screen } from '@testing-library/react';

vi.mock('@forethread/ui-components', () => ({
  ErrorPage: () => <div data-testid="error-page">Error Page</div>,
}));

import { ErrorPage } from './ErrorPage';

describe('ErrorPage', () => {
  it('re-exports the shared ErrorPage component', () => {
    render(<ErrorPage />);
    expect(screen.getByTestId('error-page')).toBeInTheDocument();
  });
});
