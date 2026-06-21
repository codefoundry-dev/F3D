import { render, screen } from '@testing-library/react';

// Mock SVG icons
vi.mock('@forethread/ui-components/assets/icons/abn.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/envelope-simple.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/legal-name.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/location.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/phone.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/tax.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/trade-name.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/web.svg?react', () => ({
  default: () => <div />,
}));

// Mock i18n
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { OverviewTab } from './OverviewTab';

const mockCompany = {
  id: 'c1',
  legalName: 'Acme Corp',
  tradeName: 'Acme Trading',
  abn: '12345678901',
  taxCode: 'GST123',
  legalAddress: '123 Main St, Sydney NSW 2000',
  contactEmail: 'info@acme.com',
  contactPhone: '+61400000000',
  website: 'https://acme.com',
};

describe('OverviewTab', () => {
  it('renders legal information section', () => {
    render(<OverviewTab company={mockCompany as never} />);
    expect(screen.getByText('legalInfo')).toBeInTheDocument();
  });

  it('renders contact information section', () => {
    render(<OverviewTab company={mockCompany as never} />);
    expect(screen.getByText('contactInfo')).toBeInTheDocument();
  });

  it('renders company legal name', () => {
    render(<OverviewTab company={mockCompany as never} />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('renders company trade name', () => {
    render(<OverviewTab company={mockCompany as never} />);
    expect(screen.getByText('Acme Trading')).toBeInTheDocument();
  });

  it('renders ABN value', () => {
    render(<OverviewTab company={mockCompany as never} />);
    expect(screen.getByText('12345678901')).toBeInTheDocument();
  });

  it('renders contact email', () => {
    render(<OverviewTab company={mockCompany as never} />);
    expect(screen.getByText('info@acme.com')).toBeInTheDocument();
  });

  it('renders dash for null values', () => {
    const companyWithNulls = {
      ...mockCompany,
      tradeName: null,
      website: null,
    };
    render(<OverviewTab company={companyWithNulls as never} />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});
