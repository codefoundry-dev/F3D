import { render, screen } from '@testing-library/react';

// Mock SVG icons
vi.mock('@forethread/ui-components/assets/icons/briefcase.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/date.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/department.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/id-badge.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/phone.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/suppliers.svg?react', () => ({
  default: () => <div />,
}));

// Mock i18n
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Mock ui-components
vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span data-testid="badge">{children}</span>,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

import { ProfileInfoGrid } from './ProfileInfoGrid';

describe('ProfileInfoGrid', () => {
  const defaultProps = {
    phone: '+61412345678',
    status: 'ACTIVE',
    role: 'COMPANY_ADMIN',
    createdAt: '2026-01-15T00:00:00Z',
    position: 'Project Manager',
    company: 'Acme Corp',
  };

  it('renders without crashing', () => {
    render(<ProfileInfoGrid {...defaultProps} />);
    expect(screen.getByText('phone')).toBeInTheDocument();
  });

  it('displays phone number', () => {
    render(<ProfileInfoGrid {...defaultProps} />);
    expect(screen.getByText('+61412345678')).toBeInTheDocument();
  });

  it('displays dash for null phone', () => {
    render(<ProfileInfoGrid {...defaultProps} phone={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('displays status badge', () => {
    render(<ProfileInfoGrid {...defaultProps} />);
    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });

  it('displays role label', () => {
    render(<ProfileInfoGrid {...defaultProps} />);
    expect(screen.getByText('role')).toBeInTheDocument();
  });

  it('displays position', () => {
    render(<ProfileInfoGrid {...defaultProps} />);
    expect(screen.getByText('Project Manager')).toBeInTheDocument();
  });

  it('displays company when provided', () => {
    render(<ProfileInfoGrid {...defaultProps} />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('does not render company field when company is null', () => {
    render(<ProfileInfoGrid {...defaultProps} company={null} />);
    expect(screen.queryByText('users:detail.company')).not.toBeInTheDocument();
  });

  it('does not render company field when company is undefined', () => {
    render(<ProfileInfoGrid {...defaultProps} company={undefined} />);
    expect(screen.queryByText('users:detail.company')).not.toBeInTheDocument();
  });
});
