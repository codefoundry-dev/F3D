import { render, screen } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@forethread/ui-components/assets/icons/users-group.svg?react', () => ({
  default: (props: Record<string, unknown>) => <svg data-testid="icon-users" {...props} />,
}));

vi.mock('./VendorContactPopover', () => ({
  VendorContactPopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="contact-popover">{children}</div>
  ),
}));

import { VendorList } from './VendorList';

const MOCK_VENDORS = [
  {
    id: 'V1',
    name: 'Acme Steel',
    avatarUrl: null,
    category: 'Steel',
    location: 'New York',
    approved: true,
    contacts: [{ id: 'C1', name: 'Alice', role: 'Sales', phone: null, email: 'alice@acme.com' }],
  },
  {
    id: 'V2',
    name: 'Beta Corp',
    avatarUrl: 'https://example.com/beta.png',
    category: 'Copper',
    location: 'Los Angeles',
    approved: false,
    contacts: [],
  },
];

describe('VendorList', () => {
  it('renders nothing for empty vendors', () => {
    const { container } = render(<VendorList vendors={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders vendor names', () => {
    render(<VendorList vendors={MOCK_VENDORS} />);
    expect(screen.getByText('Acme Steel')).toBeInTheDocument();
    expect(screen.getByText('Beta Corp')).toBeInTheDocument();
  });

  it('renders category and location', () => {
    render(<VendorList vendors={MOCK_VENDORS} />);
    expect(screen.getByText('Steel')).toBeInTheDocument();
    expect(screen.getByText('New York')).toBeInTheDocument();
    expect(screen.getByText('Copper')).toBeInTheDocument();
    expect(screen.getByText('Los Angeles')).toBeInTheDocument();
  });

  it('renders approved badge for approved vendors', () => {
    render(<VendorList vendors={MOCK_VENDORS} />);
    const badges = screen.getAllByTestId('badge');
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent('detailFields.approved');
  });

  it('renders contact popover for vendors with contacts', () => {
    render(<VendorList vendors={MOCK_VENDORS} />);
    const popovers = screen.getAllByTestId('contact-popover');
    expect(popovers).toHaveLength(1); // Only Acme Steel has contacts
  });

  it('renders avatar initials for vendor without avatar', () => {
    render(<VendorList vendors={MOCK_VENDORS} />);
    expect(screen.getByText('AS')).toBeInTheDocument(); // Acme Steel initials
  });

  it('renders avatar image for vendor with avatar URL', () => {
    render(<VendorList vendors={MOCK_VENDORS} />);
    const avatar = screen.getByAltText('Beta Corp');
    expect(avatar).toHaveAttribute('src', 'https://example.com/beta.png');
  });

  it('renders table headers', () => {
    render(<VendorList vendors={MOCK_VENDORS} />);
    expect(screen.getByText('detailFields.name')).toBeInTheDocument();
    expect(screen.getByText('detailFields.category')).toBeInTheDocument();
    expect(screen.getByText('detailFields.location')).toBeInTheDocument();
  });
});
