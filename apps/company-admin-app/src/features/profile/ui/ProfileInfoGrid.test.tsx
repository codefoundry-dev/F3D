import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));

const svgIcons = [
  'briefcase',
  'date',
  'department',
  'edit-without-line',
  'hammer',
  'id-badge',
  'phone',
  'suppliers',
];
svgIcons.forEach((name) => {
  vi.mock(`@forethread/ui-components/assets/icons/${name}.svg?react`, () => ({
    default: () => <div />,
  }));
});

import { ProfileInfoGrid } from './ProfileInfoGrid';

describe('ProfileInfoGrid', () => {
  const defaultProps = {
    phone: '+61412345678',
    status: 'ACTIVE',
    role: 'COMPANY_ADMIN',
    createdAt: '2026-01-15T00:00:00Z',
    position: 'Manager',
  };

  it('renders phone number', () => {
    render(<ProfileInfoGrid {...defaultProps} />);
    expect(screen.getByText('+61412345678')).toBeInTheDocument();
  });

  it('renders dash when phone is null', () => {
    render(<ProfileInfoGrid {...defaultProps} phone={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<ProfileInfoGrid {...defaultProps} />);
    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });

  it('renders position', () => {
    render(<ProfileInfoGrid {...defaultProps} />);
    expect(screen.getByText('Manager')).toBeInTheDocument();
  });

  it('renders position placeholder when null', () => {
    render(<ProfileInfoGrid {...defaultProps} position={null} />);
    expect(screen.getByText('positionPlaceholder')).toBeInTheDocument();
  });

  it('renders company when provided', () => {
    render(<ProfileInfoGrid {...defaultProps} company="Test Corp" />);
    expect(screen.getByText('Test Corp')).toBeInTheDocument();
  });

  it('renders projects when provided', () => {
    render(<ProfileInfoGrid {...defaultProps} projects={[{ id: 'p1', name: 'Project A' }]} />);
    expect(screen.getByText('Project A')).toBeInTheDocument();
  });

  it('renders project access button when callback provided', () => {
    const onProjectAccess = vi.fn();
    render(
      <ProfileInfoGrid
        {...defaultProps}
        projects={[{ id: 'p1', name: 'Project A' }]}
        onProjectAccess={onProjectAccess}
      />,
    );
    fireEvent.click(screen.getByText('projectAccess'));
    expect(onProjectAccess).toHaveBeenCalled();
  });

  it('does not render project access when no projects', () => {
    render(<ProfileInfoGrid {...defaultProps} />);
    expect(screen.queryByText('projectAccess')).not.toBeInTheDocument();
  });
});
