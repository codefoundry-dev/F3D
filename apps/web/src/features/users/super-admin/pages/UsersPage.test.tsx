import { render, screen } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import UsersPage from './UsersPage';

describe('UsersPage', () => {
  it('renders without crashing', () => {
    render(<UsersPage />);
    expect(screen.getByText('placeholderDescription')).toBeInTheDocument();
  });
});
