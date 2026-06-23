import { render, screen } from '@testing-library/react';

const mockRfq = vi.hoisted(() => ({
  value: {
    data: null as Record<string, unknown> | null,
    isLoading: false,
    isError: false,
  },
}));

const mockForm = vi.hoisted(() => ({
  value: {
    isEditMode: false,
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
    attachmentIds: [],
    addAttachment: vi.fn(),
    removeAttachment: vi.fn(),
    warehouses: [],
    warehousesLoading: false,
    handleSubmit: vi.fn(),
    isSubmitting: false,
    submitError: null as string | null,
    submitSuccess: false,
    validationError: null as string | null,
    isValid: true,
    showInfo: false,
    setShowInfo: vi.fn(),
  },
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'rfq-1' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('@forethread/rfq-shared', () => ({
  useRfq: () => mockRfq.value,
  usePageTitleStore: (selector: (s: { setTitle: () => void }) => unknown) =>
    selector({ setTitle: vi.fn() }),
}));

vi.mock('@forethread/api-client', () => ({
  addWarehouse: vi.fn(),
  getQuoteDetail: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
  useQuery: () => ({
    data: undefined,
    isLoading: false,
  }),
}));

vi.mock('../hooks/useCanRespond', () => ({
  useCanRespond: () => ({ canCreate: true, canEdit: false, existingQuoteId: null }),
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
    className?: string;
    leftIcon?: React.ReactNode;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  GridModal: ({
    title,
    description,
    children,
    actions,
  }: {
    title: React.ReactNode;
    description?: React.ReactNode;
    children?: React.ReactNode;
    actions?: React.ReactNode;
    icon?: React.ReactNode;
    onClose?: () => void;
  }) => (
    <div data-testid="modal">
      <span>{title}</span>
      <span>{description}</span>
      {children}
      {actions}
    </div>
  ),
  Spinner: () => <div data-testid="spinner" />,
  StatusErrorModal: ({
    title,
    description,
  }: {
    onClose: () => void;
    title: string;
    description: string;
    primaryButtonLabel: string;
    onPrimaryClick: () => void;
    secondaryButtonLabel?: string;
    onSecondaryClick?: () => void;
  }) => (
    <div data-testid="error-modal">
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
}));

vi.mock('@forethread/ui-components/assets/icons/clock-icon.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/file-text.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/paper-plane.svg?react', () => ({
  default: () => <span />,
}));

vi.mock('@/app/route-config', () => ({
  ROUTES: { rfqs: '/rfqs', rfqDetail: '/rfqs/:id', home: '/' },
}));

vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (selector: (s: { currentUser: { companyId: string } }) => unknown) =>
    selector({ currentUser: { companyId: 'company-1' } }),
}));

vi.mock('../components/AdditionalQuoteDetails', () => ({
  AdditionalQuoteDetails: () => <div data-testid="additional-details" />,
}));

vi.mock('../components/AddWarehouseModal', () => ({
  AddWarehouseModal: () => <div data-testid="warehouse-modal" />,
}));

vi.mock('../components/BulkLevelDefaults', () => ({
  BulkLevelDefaults: () => <div data-testid="bulk-defaults" />,
}));

vi.mock('../components/MaterialSearchPopup', () => ({
  MaterialSearchPopup: () => <div data-testid="material-search" />,
}));

vi.mock('../components/ResponseLineItemsTable', () => ({
  ResponseLineItemsTable: () => <div data-testid="line-items-table" />,
}));

vi.mock('../components/RfqResponseInfoPanel', () => ({
  RfqResponseInfoPanel: () => <div data-testid="info-panel" />,
}));

vi.mock('../hooks/useFileUpload', () => ({
  useFileUpload: () => ({
    attachments: [],
    uploadError: null,
    isUploading: false,
    handleFileUpload: vi.fn(),
    removeAttachment: vi.fn(),
  }),
}));

vi.mock('../hooks/useRfqResponse', () => ({
  useRfqResponse: () => mockForm.value,
}));

import RfqResponsePage from './RfqResponsePage';

describe('RfqResponsePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRfq.value = { data: null, isLoading: false, isError: false };
    mockForm.value = {
      ...mockForm.value,
      submitSuccess: false,
      submitError: null,
      isSubmitting: false,
      validationError: null,
      isValid: true,
      showInfo: false,
    };
  });

  it('shows spinner when loading', () => {
    mockRfq.value = { data: null, isLoading: true, isError: false };
    render(<RfqResponsePage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows no data message on error', () => {
    mockRfq.value = { data: null, isLoading: false, isError: true };
    render(<RfqResponsePage />);
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('shows no data when rfq is null', () => {
    mockRfq.value = { data: null, isLoading: false, isError: false };
    render(<RfqResponsePage />);
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('renders the response form when rfq is loaded', () => {
    mockRfq.value = {
      data: {
        id: 'rfq-1',
        name: 'RFQ-001',
        projectName: 'Project X',
        status: 'OPEN',
        lineItems: [],
        createdBy: { name: 'Admin' },
        deadlineEnd: '2026-12-31',
        documents: [],
      },
      isLoading: false,
      isError: false,
    };
    render(<RfqResponsePage />);
    expect(screen.getByTestId('bulk-defaults')).toBeInTheDocument();
    expect(screen.getByTestId('line-items-table')).toBeInTheDocument();
    expect(screen.getByTestId('additional-details')).toBeInTheDocument();
  });

  it('renders submit button', () => {
    mockRfq.value = {
      data: {
        id: 'rfq-1',
        name: 'RFQ-001',
        projectName: 'Project X',
        status: 'OPEN',
        lineItems: [],
        createdBy: { name: 'Admin' },
        deadlineEnd: '2026-12-31',
        documents: [],
      },
      isLoading: false,
      isError: false,
    };
    render(<RfqResponsePage />);
    expect(screen.getByText('response.submit')).toBeInTheDocument();
  });

  it('renders view info button', () => {
    mockRfq.value = {
      data: {
        id: 'rfq-1',
        name: 'RFQ-001',
        projectName: 'Project X',
        status: 'OPEN',
        lineItems: [],
        createdBy: { name: 'Admin' },
        deadlineEnd: '2026-12-31',
        documents: [],
      },
      isLoading: false,
      isError: false,
    };
    render(<RfqResponsePage />);
    expect(screen.getByText('response.viewInfo')).toBeInTheDocument();
  });

  it('shows info panel when showInfo is true', () => {
    mockForm.value = { ...mockForm.value, showInfo: true };
    mockRfq.value = {
      data: {
        id: 'rfq-1',
        name: 'RFQ-001',
        projectName: 'Project X',
        status: 'OPEN',
        lineItems: [],
        createdBy: { name: 'Admin' },
        deadlineEnd: '2026-12-31',
        documents: [],
      },
      isLoading: false,
      isError: false,
    };
    render(<RfqResponsePage />);
    expect(screen.getByTestId('info-panel')).toBeInTheDocument();
    // The "View info" toggle is hidden while the panel is open (the panel has its own ✕)
    expect(screen.queryByText('response.viewInfo')).not.toBeInTheDocument();
  });

  it('shows validation error when present', () => {
    mockForm.value = { ...mockForm.value, validationError: 'response.validationNoItems' };
    mockRfq.value = {
      data: {
        id: 'rfq-1',
        name: 'RFQ-001',
        projectName: 'Project X',
        status: 'OPEN',
        lineItems: [],
        createdBy: { name: 'Admin' },
        deadlineEnd: '2026-12-31',
        documents: [],
      },
      isLoading: false,
      isError: false,
    };
    render(<RfqResponsePage />);
    expect(screen.getByText('response.validationNoItems')).toBeInTheDocument();
  });
});
