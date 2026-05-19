import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components/assets/icons/arrow-right.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/department.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/new-user.svg?react', () => ({
  default: () => <div />,
}));

vi.mock('@/app/route-config', () => ({
  ROUTES: { users: '/settings/users', companyProfile: '/settings/company' },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import SettingsPage from './SettingsPage';

describe('SettingsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the users settings link', () => {
    render(<SettingsPage />);
    expect(screen.getByText('users')).toBeInTheDocument();
  });

  it('renders the company settings link', () => {
    render(<SettingsPage />);
    expect(screen.getByText('company')).toBeInTheDocument();
  });

  it('navigates to /settings/users when clicking the users link', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('users'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings/users');
  });

  it('navigates to /settings/company when clicking the company link', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('company'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings/company');
  });
});
