import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@forethread/ui-components/assets/icons/eye-closed.svg?react', () => ({
  default: (props: Record<string, unknown>) => <svg data-testid="icon-eye-closed" {...props} />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: (props: Record<string, unknown>) => <svg data-testid="icon-eye" {...props} />,
}));

vi.mock('@forethread/shared-types/client', () => ({
  QuoteResponseStatus: {
    APPROVED: 'APPROVED',
    DECLINED: 'DECLINED',
    PENDING: 'PENDING',
  },
}));

vi.mock('@forethread/rfq-shared', () => ({
  DetailRow: ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
  DetailField: ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
  SectionDivider: () => <hr />,
  SectionTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  formatDate: (d: string | undefined | null) => d ?? '-',
  formatCurrency: (v: number) => `$${v.toFixed(2)}`,
  VendorList: ({ vendors }: { vendors: unknown[] }) => (
    <div data-testid="vendor-list">Vendors: {vendors.length}</div>
  ),
}));

import { RfqDetailsTab } from './RfqDetailsTab';

const MOCK_RFQ = {
  id: 'RFQ-2024-008',
  rfqNumber: 'RFQ-2024-008',
  name: 'Test RFQ',
  projectName: 'Test Project',
  projectId: 'PRJ-001',
  status: 'IN_REVIEW',
  rfqType: 'Standard',
  paymentTerms: 'Net 30',
  pickUp: true,
  pickUpDate: null,
  deliveryLocation: '123 Main St',
  pickUpLocation: null,
  deadlineStart: '2024-03-01',
  deadlineEnd: '2024-03-15',
  needByDate: '2024-04-01',
  totalRequestedQty: 500,
  approvalStatus: 'Pending',
  approvedBy: { id: '2', name: 'Jane Smith' },
  createdBy: { id: '1', name: 'John Doe' },
  lastModifiedBy: { id: '3', name: 'Bob Wilson' },
  lineItems: [
    {
      id: 'LI-001',
      projectName: 'Test Project',
      materialName: 'Steel',
      description: null,
      quantity: 100,
      unit: 'kg',
      expectedDeliveryDate: null,
      deliveryLocation: null,
    },
    {
      id: 'LI-002',
      projectName: 'Test Project',
      materialName: 'Copper',
      description: null,
      quantity: 200,
      unit: 'kg',
      expectedDeliveryDate: null,
      deliveryLocation: null,
    },
  ],
  vendors: [
    {
      id: 'V1',
      name: 'Vendor A',
      avatarUrl: null,
      category: 'Steel',
      location: 'NYC',
      approved: true,
      contacts: [],
    },
    {
      id: 'V2',
      name: 'Vendor B',
      avatarUrl: null,
      category: 'Copper',
      location: 'LA',
      approved: false,
      contacts: [],
    },
  ],
  quoteResponses: [
    {
      id: 'Q1',
      vendorId: 'V1',
      vendorName: 'Vendor A',
      totalCost: 1000,
      discountPercent: null,
      discountAmount: null,
      itemsCovered: 5,
      totalItems: 5,
      status: 'APPROVED',
      submittedAt: null,
    },
    {
      id: 'Q2',
      vendorId: 'V2',
      vendorName: 'Vendor B',
      totalCost: 1200,
      discountPercent: null,
      discountAmount: null,
      itemsCovered: 3,
      totalItems: 5,
      status: 'DECLINED',
      submittedAt: null,
    },
    {
      id: 'Q3',
      vendorId: 'V3',
      vendorName: 'Vendor C',
      totalCost: 900,
      discountPercent: null,
      discountAmount: null,
      itemsCovered: 5,
      totalItems: 5,
      status: 'PENDING',
      submittedAt: null,
    },
  ],
  documents: [],
  createdAt: '2024-01-15T00:00:00Z',
  updatedAt: '2024-01-20T00:00:00Z',
};

describe('RfqDetailsTab', () => {
  describe('panel layout', () => {
    it('renders basic information section', () => {
      render(<RfqDetailsTab rfq={MOCK_RFQ} layout="panel" />);
      expect(screen.getByText('detailFields.basicInformation')).toBeInTheDocument();
      expect(screen.getByText('RFQ-2024-008')).toBeInTheDocument();
      expect(screen.getByText('Test RFQ')).toBeInTheDocument();
      expect(screen.getByText('PRJ-001')).toBeInTheDocument();
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    it('renders items and quantities section', () => {
      render(<RfqDetailsTab rfq={MOCK_RFQ} layout="panel" />);
      expect(screen.getByText('detailFields.itemsAndQuantities')).toBeInTheDocument();
      // "2" appears multiple times (line items count + invited vendors)
      const twos = screen.getAllByText('2');
      expect(twos.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('500')).toBeInTheDocument(); // total qty
    });

    it('renders vendors section with counts', () => {
      render(<RfqDetailsTab rfq={MOCK_RFQ} layout="panel" />);
      expect(screen.getByText('detailFields.vendors')).toBeInTheDocument();
    });

    it('toggles vendor list visibility', () => {
      render(<RfqDetailsTab rfq={MOCK_RFQ} layout="panel" />);
      expect(screen.queryByTestId('vendor-list')).not.toBeInTheDocument();

      // Click the eye icon to show vendors
      const eyeButton = screen.getByTitle('actions.view');
      fireEvent.click(eyeButton);
      expect(screen.getByTestId('vendor-list')).toBeInTheDocument();

      // Click again to hide
      fireEvent.click(eyeButton);
      expect(screen.queryByTestId('vendor-list')).not.toBeInTheDocument();
    });

    it('renders quote information section', () => {
      render(<RfqDetailsTab rfq={MOCK_RFQ} layout="panel" />);
      expect(screen.getByText('detailFields.quoteInformation')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // received quotes
      // approved quotes count = 1, declined = 1 — both render "1"
      const onesInDom = screen.getAllByText('1');
      expect(onesInDom.length).toBeGreaterThanOrEqual(2); // approved + declined
    });

    it('renders metadata section', () => {
      render(<RfqDetailsTab rfq={MOCK_RFQ} layout="panel" />);
      expect(screen.getByText('detailFields.metadata')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
    });

    it('renders approval status badge', () => {
      render(<RfqDetailsTab rfq={MOCK_RFQ} layout="panel" />);
      const badges = screen.getAllByTestId('badge');
      const approvalBadge = badges.find((b) => b.textContent?.includes('Pending'));
      expect(approvalBadge).toBeInTheDocument();
    });
  });

  describe('panel layout – branch coverage', () => {
    it('renders dash for null approvalStatus', () => {
      const rfq = { ...MOCK_RFQ, approvalStatus: null };
      render(<RfqDetailsTab rfq={rfq} layout="panel" />);
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThan(0);
    });

    it('renders deadline with only deadlineEnd', () => {
      const rfq = { ...MOCK_RFQ, deadlineStart: null, deadlineEnd: '2024-04-01' };
      render(<RfqDetailsTab rfq={rfq} layout="panel" />);
      expect(screen.getAllByText('2024-04-01').length).toBeGreaterThanOrEqual(1);
    });

    it('renders deadline with only deadlineStart', () => {
      const rfq = { ...MOCK_RFQ, deadlineStart: '2024-03-01', deadlineEnd: null };
      render(<RfqDetailsTab rfq={rfq} layout="panel" />);
      expect(screen.getByText('2024-03-01')).toBeInTheDocument();
    });

    it('renders dash for null approvedBy', () => {
      const rfq = { ...MOCK_RFQ, approvedBy: null };
      render(<RfqDetailsTab rfq={rfq} layout="panel" />);
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThan(0);
    });

    it('renders dash for null lastModifiedBy', () => {
      const rfq = { ...MOCK_RFQ, lastModifiedBy: null };
      render(<RfqDetailsTab rfq={rfq} layout="panel" />);
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThan(0);
    });

    it('renders with empty quoteResponses', () => {
      const rfq = { ...MOCK_RFQ, quoteResponses: [] };
      render(<RfqDetailsTab rfq={rfq} layout="panel" />);
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(1);
    });

    it('renders with empty vendors', () => {
      const rfq = { ...MOCK_RFQ, vendors: [] };
      render(<RfqDetailsTab rfq={rfq} layout="panel" />);
      expect(screen.getByText('detailFields.vendors')).toBeInTheDocument();
    });
  });

  describe('page layout', () => {
    it('renders cards in page layout', () => {
      render(<RfqDetailsTab rfq={MOCK_RFQ} layout="page" />);
      expect(screen.getByText('detailFields.basicInformation')).toBeInTheDocument();
      expect(screen.getByText('detailFields.quoteInformation')).toBeInTheDocument();
      expect(screen.getByText('detailFields.vendors')).toBeInTheDocument();
      expect(screen.getByText('detailFields.metadata')).toBeInTheDocument();
    });

    it('renders vendor list directly in page layout', () => {
      render(<RfqDetailsTab rfq={MOCK_RFQ} layout="page" />);
      expect(screen.getByTestId('vendor-list')).toBeInTheDocument();
    });

    it('renders dash for null approvalStatus in page layout', () => {
      const rfq = { ...MOCK_RFQ, approvalStatus: null };
      render(<RfqDetailsTab rfq={rfq} layout="page" />);
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThan(0);
    });

    it('renders deadline fallback in page layout', () => {
      const rfq = { ...MOCK_RFQ, deadlineStart: null, deadlineEnd: '2024-05-10' };
      render(<RfqDetailsTab rfq={rfq} layout="page" />);
      expect(screen.getByText('2024-05-10')).toBeInTheDocument();
    });
  });
});
