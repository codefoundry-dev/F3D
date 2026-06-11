import { render, screen } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/rfq-shared', () => ({
  DetailRow: ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <span>{label}</span>
      <span>{typeof value === 'string' ? value : ''}</span>
      {typeof value !== 'string' && value}
    </div>
  ),
  DetailField: ({ label, value }: { label: string; value: string }) => (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
  SectionDivider: () => <hr />,
  SectionTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  formatDate: (d: string) => d,
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
  getStatusColor: () => '',
  VENDOR_RFQ_STATUS_COLORS: {},
}));

import { VendorRfqDetailsTab } from './VendorRfqDetailsTab';

const rfq = {
  id: 'rfq-1',
  name: 'RFQ-001',
  projectName: 'Project X',
  status: 'OPEN',
  deliveryLocation: 'Warehouse A',
  deadlineStart: '2026-02-01',
  deadlineEnd: '2026-03-01',
  createdAt: '2026-01-15',
  createdBy: { name: 'Admin' },
  lineItems: [{ id: 'li-1' }, { id: 'li-2' }],
  totalRequestedQty: 100,
  pickUp: true,
} as never;

describe('VendorRfqDetailsTab', () => {
  it('renders panel layout by default', () => {
    render(<VendorRfqDetailsTab rfq={rfq} />);
    expect(screen.getByText('detailFields.rfqDetails')).toBeInTheDocument();
    expect(screen.getByText('rfq-1')).toBeInTheDocument();
    expect(screen.getByText('Project X')).toBeInTheDocument();
  });

  it('renders items and quantities section in panel', () => {
    render(<VendorRfqDetailsTab rfq={rfq} />);
    expect(screen.getByText('detailFields.itemsAndQuantities')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // lineItems.length
  });

  it('renders metadata section in panel', () => {
    render(<VendorRfqDetailsTab rfq={rfq} />);
    expect(screen.getByText('detailFields.metadata')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('renders page layout when specified', () => {
    render(<VendorRfqDetailsTab rfq={rfq} layout="page" />);
    expect(screen.getByText('detailFields.rfqDetails')).toBeInTheDocument();
    expect(screen.getByText('rfq-1')).toBeInTheDocument();
  });

  it('renders delivery location in page layout', () => {
    render(<VendorRfqDetailsTab rfq={rfq} layout="page" />);
    expect(screen.getByText('Warehouse A')).toBeInTheDocument();
  });

  it('shows dash when delivery location is null', () => {
    const rfqNoLocation = { ...(rfq as Record<string, unknown>), deliveryLocation: null } as never;
    render(<VendorRfqDetailsTab rfq={rfqNoLocation} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('uses deadlineEnd when deadlineStart is null', () => {
    const rfqNoStart = {
      ...(rfq as Record<string, unknown>),
      deadlineStart: null,
      deadlineEnd: '2026-03-01',
    } as never;
    render(<VendorRfqDetailsTab rfq={rfqNoStart} />);
    expect(screen.getByText('2026-03-01')).toBeInTheDocument();
  });

  it('renders page layout with null delivery location as dash', () => {
    const rfqNullDL = { ...(rfq as Record<string, unknown>), deliveryLocation: null } as never;
    render(<VendorRfqDetailsTab rfq={rfqNullDL} layout="page" />);
    // Both the empty delivery location and the (not yet available) email render as '-'
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(1);
  });

  it('renders page layout pickUp as no when false', () => {
    const rfqNoPickup = { ...(rfq as Record<string, unknown>), pickUp: false } as never;
    render(<VendorRfqDetailsTab rfq={rfqNoPickup} layout="page" />);
    expect(screen.getByText('common:no')).toBeInTheDocument();
  });

  it('renders panel layout with empty lineItems', () => {
    const rfqEmptyItems = { ...(rfq as Record<string, unknown>), lineItems: null } as never;
    render(<VendorRfqDetailsTab rfq={rfqEmptyItems} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
