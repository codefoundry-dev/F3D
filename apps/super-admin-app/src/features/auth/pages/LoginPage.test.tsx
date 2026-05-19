import { render, screen } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import LoginPage from './LoginPage';

describe('LoginPage', () => {
  it('renders without crashing', () => {
    render(<LoginPage />);
  });

  it('displays the portal name and placeholder description', () => {
    render(<LoginPage />);
    expect(screen.getByText('auth:portalName')).toBeInTheDocument();
    expect(screen.getByText('auth:loginPlaceholderDescription')).toBeInTheDocument();
  });
});
