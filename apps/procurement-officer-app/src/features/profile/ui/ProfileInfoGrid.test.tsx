vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

import { render, screen } from '@testing-library/react';

import { ProfileInfoGrid } from './ProfileInfoGrid';

describe('ProfileInfoGrid', () => {
  const defaultProps = {
    phone: '+1234567890',
    status: 'ACTIVE',
    role: 'PROCUREMENT_OFFICER',
    createdAt: '2024-01-15T10:00:00Z',
    position: 'Manager',
    company: 'Test Corp',
  };

  it('renders all fields', () => {
    render(<ProfileInfoGrid {...defaultProps} />);
    expect(screen.getByText('+1234567890')).toBeInTheDocument();
    expect(screen.getByText('users:statuses.ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('users:roles.PROCUREMENT_OFFICER')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
    expect(screen.getByText('Test Corp')).toBeInTheDocument();
  });

  it('shows dash for null phone', () => {
    render(<ProfileInfoGrid {...defaultProps} phone={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows placeholder for null position', () => {
    render(<ProfileInfoGrid {...defaultProps} position={null} />);
    expect(screen.getByText('positionPlaceholder')).toBeInTheDocument();
  });

  it('hides company when null', () => {
    render(<ProfileInfoGrid {...defaultProps} company={null} />);
    expect(screen.queryByText('users:detail.company')).not.toBeInTheDocument();
  });

  it('hides company when undefined', () => {
    render(<ProfileInfoGrid {...defaultProps} company={undefined} />);
    expect(screen.queryByText('users:detail.company')).not.toBeInTheDocument();
  });
});
