import { render, screen } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const svgIcons = [
  'envelope-simple',
  'legal-name',
  'location',
  'my-abn',
  'phone',
  'tax',
  'trade-name',
  'web',
];
svgIcons.forEach((name) => {
  vi.mock(`@forethread/ui-components/assets/icons/${name}.svg?react`, () => ({
    default: () => <div />,
  }));
});

import { OverviewTab } from './OverviewTab';

const mockCompany = {
  id: 'c1',
  legalName: 'Test Corp',
  tradeName: 'Test Trade',
  abn: '12345678901',
  taxCode: '123',
  legalAddress: '123 Main St',
  contactEmail: 'test@test.com',
  contactPhone: '+61400000000',
  website: 'https://test.com',
  specialisations: [],
  type: 'CONTRACTOR' as const,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

describe('OverviewTab', () => {
  it('renders legal info section', () => {
    render(<OverviewTab company={mockCompany as any} />);
    expect(screen.getByText('legalInfo')).toBeInTheDocument();
  });

  it('renders company legal name', () => {
    render(<OverviewTab company={mockCompany as any} />);
    expect(screen.getByText('Test Corp')).toBeInTheDocument();
  });

  it('renders contact info section', () => {
    render(<OverviewTab company={mockCompany as any} />);
    expect(screen.getByText('contactInfo')).toBeInTheDocument();
  });

  it('renders contact email', () => {
    render(<OverviewTab company={mockCompany as any} />);
    expect(screen.getByText('test@test.com')).toBeInTheDocument();
  });

  it('renders dash for null values', () => {
    render(<OverviewTab company={{ ...mockCompany, tradeName: null } as any} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
