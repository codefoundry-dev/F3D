import { render, screen } from '@testing-library/react';

const mockQueryResult = vi.hoisted(() => ({
  value: {
    data: null as Record<string, unknown> | null,
    isLoading: false,
    isError: false,
  },
}));

const mockGuestForm = vi.hoisted(() => ({
  value: {
    bulkDefaults: {
      bulkAvailability: '',
      bulkDiscount: '',
      bulkTax: '',
      shipment: '',
      warehouseLocationId: '',
      bulkDeliveryTime: '',
    },
    setBulkField: vi.fn(),
    bulkExpanded: false,
    setBulkExpanded: vi.fn(),
    lineItems: [],
    toggleInclude: vi.fn(),
    updateLineItem: vi.fn(),
    toggleExpanded: vi.fn(),
    totals: {
      totalItemsQuoted: 0,
      totalItems: 0,
      subtotal: 0,
      discountTotal: 0,
      gstTotal: 0,
      totalQuote: 0,
    },
    validityPeriod: '',
    setValidityPeriod: vi.fn(),
    additionalNotes: '',
    setAdditionalNotes: vi.fn(),
    showInfo: false,
    setShowInfo: vi.fn(),
    handleSubmit: vi.fn(),
    isSubmitting: false,
    submitError: null as string | null,
    submitSuccess: false,
  },
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ token: 'test-token-123' }),
}));

vi.mock('@forethread/api-client', () => ({
  getGuestRfq: vi.fn(),
}));

vi.mock('@forethread/ui-components', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    size?: string;
    leftIcon?: React.ReactNode;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Modal: ({ children }: { children: React.ReactNode }) => <div data-testid="modal">{children}</div>,
  ModalBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ModalIconHeader: ({
    title,
    subtitle,
  }: {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    onClose: () => void;
  }) => (
    <div>
      <span>{title}</span>
      <span>{subtitle}</span>
    </div>
  ),
  Spinner: ({ size }: { size?: string }) => <div data-testid="spinner" data-size={size} />,
  StatusErrorModal: ({
    title,
    description,
  }: {
    onClose: () => void;
    title: string;
    description: string;
    primaryButtonLabel: string;
    onPrimaryClick: () => void;
  }) => (
    <div data-testid="error-modal">
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
}));

vi.mock('@forethread/ui-components/assets/icons/file-text.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/info.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/paper-plane.svg?react', () => ({
  default: () => <span />,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => mockQueryResult.value,
}));

vi.mock('../components/AdditionalQuoteDetails', () => ({
  AdditionalQuoteDetails: () => <div data-testid="additional-details" />,
}));

vi.mock('../components/BulkLevelDefaults', () => ({
  BulkLevelDefaults: () => <div data-testid="bulk-defaults" />,
}));

vi.mock('../components/ResponseLineItemsTable', () => ({
  ResponseLineItemsTable: () => <div data-testid="line-items-table" />,
}));

vi.mock('../hooks/useGuestRfqResponse', () => ({
  useGuestRfqResponse: () => mockGuestForm.value,
}));

import GuestInvitationPage from './GuestInvitationPage';

describe('GuestInvitationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryResult.value = { data: null, isLoading: false, isError: false };
    mockGuestForm.value = {
      ...mockGuestForm.value,
      submitSuccess: false,
      submitError: null,
      isSubmitting: false,
    };
  });

  it('shows spinner when loading', () => {
    mockQueryResult.value = { data: null, isLoading: true, isError: false };
    render(<GuestInvitationPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows invalid token alert on error', () => {
    mockQueryResult.value = { data: null, isLoading: false, isError: true };
    render(<GuestInvitationPage />);
    expect(screen.getByText('guest.invalidToken')).toBeInTheDocument();
  });

  it('shows invalid token when rfq is null and no error', () => {
    mockQueryResult.value = { data: null, isLoading: false, isError: false };
    render(<GuestInvitationPage />);
    expect(screen.getByText('guest.invalidToken')).toBeInTheDocument();
  });

  it('renders the full response form when rfq is loaded', () => {
    mockQueryResult.value = {
      data: {
        id: 'rfq-1',
        rfqNumber: 'RFQ-001',
        contractorName: 'Contractor Corp',
        vendorName: 'Vendor Inc',
        projectName: 'Project X',
        deliveryLocation: 'Warehouse A',
        needByDate: '2026-04-01',
        lineItems: [],
      },
      isLoading: false,
      isError: false,
    };
    render(<GuestInvitationPage />);
    expect(screen.getByText('guest.rfqDetails')).toBeInTheDocument();
    expect(screen.getByText('Contractor Corp')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-defaults')).toBeInTheDocument();
    expect(screen.getByTestId('line-items-table')).toBeInTheDocument();
    expect(screen.getByTestId('additional-details')).toBeInTheDocument();
  });

  it('renders the header with submit button', () => {
    mockQueryResult.value = {
      data: {
        id: 'rfq-1',
        rfqNumber: 'RFQ-001',
        contractorName: 'Contractor Corp',
        vendorName: 'Vendor Inc',
        lineItems: [],
      },
      isLoading: false,
      isError: false,
    };
    render(<GuestInvitationPage />);
    expect(screen.getByText('response.submit')).toBeInTheDocument();
  });

  it('shows project name when present', () => {
    mockQueryResult.value = {
      data: {
        id: 'rfq-1',
        rfqNumber: 'RFQ-001',
        contractorName: 'Contractor Corp',
        vendorName: 'Vendor Inc',
        projectName: 'Big Project',
        lineItems: [],
      },
      isLoading: false,
      isError: false,
    };
    render(<GuestInvitationPage />);
    expect(screen.getByText('Big Project')).toBeInTheDocument();
  });

  it('shows delivery location when present', () => {
    mockQueryResult.value = {
      data: {
        id: 'rfq-1',
        rfqNumber: 'RFQ-001',
        contractorName: 'Contractor Corp',
        vendorName: 'Vendor Inc',
        deliveryLocation: 'Site B',
        lineItems: [],
      },
      isLoading: false,
      isError: false,
    };
    render(<GuestInvitationPage />);
    expect(screen.getByText('Site B')).toBeInTheDocument();
  });
});
