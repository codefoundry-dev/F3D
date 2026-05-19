import { render, screen } from '@testing-library/react';

vi.mock('@forethread/ui-components', () => ({
  ErrorPage: () => <div data-testid="error-page">Error Page</div>,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

import { ErrorPage } from './ErrorPage';

describe('ErrorPage', () => {
  it('re-exports the shared ErrorPage component', () => {
    render(<ErrorPage />);
    expect(screen.getByTestId('error-page')).toBeInTheDocument();
  });
});
