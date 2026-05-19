import { render, screen, fireEvent } from '@testing-library/react';

const mockNavigate = vi.fn();

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import SettingsPage from './SettingsPage';

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the users settings link', () => {
    render(<SettingsPage />);
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText('usersSubtitle')).toBeInTheDocument();
  });

  it('navigates to /settings/users when clicking the users link', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('users'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings/users');
  });
});
