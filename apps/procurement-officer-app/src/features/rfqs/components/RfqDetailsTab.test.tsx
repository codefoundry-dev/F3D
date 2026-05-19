vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/rfq-shared', () => ({
  DetailRow: ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <span>{label}</span>
      <span>{typeof value === 'string' ? value : ''}</span>
    </div>
  ),
  DetailField: ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <span>{label}</span>
      <span>{typeof value === 'string' ? value : ''}</span>
    </div>
  ),
  SectionDivider: () => <hr />,
  SectionTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  formatDate: (d: string | undefined | null) => d ?? '-',
  formatCurrency: (v: number) => `$${v.toFixed(2)}`,
  VendorList: () => <div data-testid="vendor-list" />,
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

import { render, screen, fireEvent } from '@testing-library/react';

import { RfqDetailsTab } from './RfqDetailsTab';

const mockRfq = {
  id: 'rfq-1',
  name: 'Test RFQ',
  projectId: 'prj-1',
  projectName: 'Project A',
  rfqType: 'Standard',
  paymentTerms: 'Net 30',
  pickUp: true,
  deadlineStart: '2024-01-01',
  deadlineEnd: '2024-02-01',
  deliveryLocation: 'NYC',
  needByDate: '2024-03-01',
  status: 'OPEN',
  lineItems: [{ id: 'li-1' }, { id: 'li-2' }],
  totalRequestedQty: 100,
  quoteResponses: [
    { id: 'q1', status: 'APPROVED', totalCost: 5000 },
    { id: 'q2', status: 'DECLINED', totalCost: 6000 },
    { id: 'q3', status: 'PENDING', totalCost: 7000 },
  ],
  createdAt: '2024-01-01T00:00:00Z',
  approvalStatus: 'Approved',
  createdBy: { name: 'Admin' },
  approvedBy: { name: 'Approver' },
  lastModifiedBy: { name: 'Editor' },
  vendors: [
    { id: 'v1', approved: true },
    { id: 'v2', approved: false },
  ],
};

describe('RfqDetailsTab', () => {
  it('renders panel layout by default', () => {
    render(<RfqDetailsTab rfq={mockRfq as never} />);
    expect(screen.getByText('detailFields.basicInformation')).toBeInTheDocument();
    expect(screen.getByText('detailFields.itemsAndQuantities')).toBeInTheDocument();
    expect(screen.getByText('detailFields.quoteInformation')).toBeInTheDocument();
    expect(screen.getByText('detailFields.metadata')).toBeInTheDocument();
  });

  it('renders page layout', () => {
    render(<RfqDetailsTab rfq={mockRfq as never} layout="page" />);
    expect(screen.getByText('detailFields.basicInformation')).toBeInTheDocument();
  });

  it('computes quote stats correctly', () => {
    render(<RfqDetailsTab rfq={mockRfq as never} layout="page" />);
    // approved=1, declined=1, approvedVendors=1 → three '1's
    expect(screen.getAllByText('1')).toHaveLength(3);
    expect(screen.getAllByText('3').length).toBeGreaterThan(0); // received
  });

  it('handles null optional fields', () => {
    const rfqNoOptionals = {
      ...mockRfq,
      name: null,
      rfqType: null,
      paymentTerms: null,
      deliveryLocation: null,
      approvalStatus: null,
      approvedBy: null,
      lastModifiedBy: null,
      deadlineStart: null,
      deadlineEnd: null,
    };
    render(<RfqDetailsTab rfq={rfqNoOptionals as never} />);
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('shows pickUp as yes/no', () => {
    render(<RfqDetailsTab rfq={mockRfq as never} />);
    expect(screen.getByText('common:yes')).toBeInTheDocument();
  });

  it('shows pickUp as no when false', () => {
    render(<RfqDetailsTab rfq={{ ...mockRfq, pickUp: false } as never} />);
    expect(screen.getByText('common:no')).toBeInTheDocument();
  });

  it('handles empty quoteResponses', () => {
    render(<RfqDetailsTab rfq={{ ...mockRfq, quoteResponses: [] } as never} />);
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('handles null quoteResponses', () => {
    render(<RfqDetailsTab rfq={{ ...mockRfq, quoteResponses: null } as never} />);
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('handles null lineItems', () => {
    render(<RfqDetailsTab rfq={{ ...mockRfq, lineItems: null } as never} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('handles deadlineStart only', () => {
    render(<RfqDetailsTab rfq={{ ...mockRfq, deadlineEnd: null } as never} />);
    expect(screen.getByText('detailFields.resDeadline')).toBeInTheDocument();
  });

  it('handles deadlineEnd only', () => {
    render(<RfqDetailsTab rfq={{ ...mockRfq, deadlineStart: null } as never} />);
    expect(screen.getByText('detailFields.resDeadline')).toBeInTheDocument();
  });

  it('handles both deadlines null', () => {
    render(<RfqDetailsTab rfq={{ ...mockRfq, deadlineStart: null, deadlineEnd: null } as never} />);
    expect(screen.getByText('detailFields.resDeadline')).toBeInTheDocument();
  });

  it('renders page layout with null optional fields', () => {
    const rfqNulls = {
      ...mockRfq,
      name: null,
      rfqType: null,
      paymentTerms: null,
      deliveryLocation: null,
      approvalStatus: null,
      approvedBy: null,
      lastModifiedBy: null,
      lineItems: null,
      quoteResponses: null,
    };
    render(<RfqDetailsTab rfq={rfqNulls as never} layout="page" />);
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders page layout with pickUp false', () => {
    render(<RfqDetailsTab rfq={{ ...mockRfq, pickUp: false } as never} layout="page" />);
    expect(screen.getByText('common:no')).toBeInTheDocument();
  });

  it('renders page layout with partial deadlines', () => {
    render(<RfqDetailsTab rfq={{ ...mockRfq, deadlineEnd: null } as never} layout="page" />);
    expect(screen.getByText('detailFields.resDeadline')).toBeInTheDocument();
  });

  it('toggles vendor visibility on eye button click', () => {
    render(<RfqDetailsTab rfq={mockRfq as never} />);
    const eyeBtn = screen.getByTitle('actions.view');
    // Initially vendors hidden
    expect(screen.queryByTestId('vendor-list')).not.toBeInTheDocument();
    // Click to show vendors
    fireEvent.click(eyeBtn);
    expect(screen.getByTestId('vendor-list')).toBeInTheDocument();
    // Click again to hide
    fireEvent.click(eyeBtn);
    expect(screen.queryByTestId('vendor-list')).not.toBeInTheDocument();
  });
});
