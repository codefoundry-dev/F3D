import { render, screen } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
}));

vi.mock('@forethread/ui-components/assets/icons/briefcase.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/date.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/department.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/id-badge.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/phone.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/suppliers.svg?react', () => ({
  default: () => <span />,
}));

import { ProfileInfoGrid } from './ProfileInfoGrid';

const defaultProps = {
  phone: '+1234567890',
  status: 'ACTIVE',
  role: 'VENDOR',
  createdAt: '2026-01-15T00:00:00.000Z',
  position: 'Manager',
  company: 'Acme Corp',
};

describe('ProfileInfoGrid', () => {
  it('renders phone number', () => {
    render(<ProfileInfoGrid {...defaultProps} />);
    expect(screen.getByText('+1234567890')).toBeInTheDocument();
  });

  it('renders dash when phone is null', () => {
    render(<ProfileInfoGrid {...defaultProps} phone={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<ProfileInfoGrid {...defaultProps} />);
    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });

  it('renders role', () => {
    render(<ProfileInfoGrid {...defaultProps} />);
    expect(screen.getByText('users:roles.VENDOR')).toBeInTheDocument();
  });

  it('renders position', () => {
    render(<ProfileInfoGrid {...defaultProps} />);
    expect(screen.getByText('Manager')).toBeInTheDocument();
  });

  it('renders placeholder when position is null', () => {
    render(<ProfileInfoGrid {...defaultProps} position={null} />);
    expect(screen.getByText('positionPlaceholder')).toBeInTheDocument();
  });

  it('renders company when provided', () => {
    render(<ProfileInfoGrid {...defaultProps} />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('does not render company field when null', () => {
    render(<ProfileInfoGrid {...defaultProps} company={null} />);
    expect(screen.queryByText('users:detail.company')).not.toBeInTheDocument();
  });

  it('does not render company field when undefined', () => {
    render(<ProfileInfoGrid {...defaultProps} company={undefined} />);
    expect(screen.queryByText('users:detail.company')).not.toBeInTheDocument();
  });
});
