import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/ui-components/assets/icons/image.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/envelope-simple.svg?react', () => ({
  default: () => <div />,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number }) =>
      opts?.count !== undefined ? `${key}:${opts.count}` : key,
  }),
}));

vi.mock('@forethread/ui-components', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  Spinner: () => <div data-testid="spinner" />,
}));

import { CompanyProfileHeaderCard } from './CompanyProfileHeaderCard';

const company = {
  id: 'c1',
  legalName: 'Acme Corp',
  contactEmail: 'info@acme.com',
  logoUrl: null,
} as never;

describe('CompanyProfileHeaderCard', () => {
  it('renders the company name and email', () => {
    render(<CompanyProfileHeaderCard company={company} />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('info@acme.com')).toBeInTheDocument();
  });

  it('renders initials when there is no logo', () => {
    render(<CompanyProfileHeaderCard company={company} />);
    expect(screen.getByText('AC')).toBeInTheDocument();
  });

  it('renders the logo image when a logoUrl is provided', () => {
    render(<CompanyProfileHeaderCard company={company} logoUrl="https://x/y.png" />);
    const img = screen.getByAltText('Acme Corp');
    expect(img).toHaveAttribute('src', 'https://x/y.png');
  });

  it('renders active and inactive user count pills', () => {
    render(<CompanyProfileHeaderCard company={company} activeCount={5} inactiveCount={1} />);
    expect(screen.getByText('usersCount:5')).toBeInTheDocument();
    expect(screen.getByText('usersCount:1')).toBeInTheDocument();
  });

  it('renders the actions slot', () => {
    render(<CompanyProfileHeaderCard company={company} actions={<button>Invite</button>} />);
    expect(screen.getByText('Invite')).toBeInTheDocument();
  });

  it('makes the avatar clickable when onAvatarClick is provided', () => {
    const onAvatarClick = vi.fn();
    render(<CompanyProfileHeaderCard company={company} onAvatarClick={onAvatarClick} />);
    fireEvent.click(screen.getByLabelText('Change avatar'));
    expect(onAvatarClick).toHaveBeenCalled();
  });

  it('does not render an avatar button without onAvatarClick', () => {
    render(<CompanyProfileHeaderCard company={company} />);
    expect(screen.queryByLabelText('Change avatar')).not.toBeInTheDocument();
  });
});
