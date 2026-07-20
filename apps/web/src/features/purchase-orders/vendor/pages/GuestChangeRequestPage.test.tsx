const mockQuery = vi.hoisted(() => ({
  value: {
    data: {
      id: 'po-1',
      poNumber: 'PO-001',
      lineItems: [{ id: 'li-1', materialName: 'Steel Beam' }],
    } as Record<string, unknown> | null,
    isLoading: false,
    isError: false,
    error: null as unknown,
  },
}));
const mockMutate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useParams: () => ({ token: 'tok-1' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => mockQuery.value,
  useMutation: () => ({ mutate: mockMutate, isPending: false }),
}));

vi.mock('@forethread/api-client', () => ({
  getPublicPurchaseOrder: vi.fn(),
  proposePublicPoChange: vi.fn(),
  isApiError: (_e: unknown, code: number) => code === 403,
}));

vi.mock('@forethread/po-shared', () => ({
  poToFormDefaults: () => ({
    defaultValues: {
      message: '',
      lineItems: [
        {
          lineItemId: 'li-1',
          materialName: 'Steel Beam',
          unitPrice: 5,
          quantityOrdered: 2,
          expectedDeliveryDate: '',
          notes: '',
        },
      ],
    },
  }),
  computePoChangedFields: () => ({ fields: { paymentTermsDays: { from: 30, to: 45 } } }),
  deriveChangeType: () => 'COMMERCIAL',
  hasAnyChange: () => true,
  PoChangeDiff: () => <div data-testid="diff" />,
}));

vi.mock('@forethread/ui-components', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Input: (props: Record<string, unknown>) => <input {...props} />,
  DatePicker: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
  ),
  Textarea: ({ value, onChange }: { value?: string; onChange: (e: unknown) => void }) => (
    <textarea value={value ?? ''} onChange={onChange} />
  ),
  FormField: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Spinner: () => <div data-testid="spinner" />,
  Alert: ({ children }: { children: React.ReactNode }) => <div role="alert">{children}</div>,
  StatusSuccessModal: () => <div data-testid="success-modal" />,
  StatusErrorModal: () => <div data-testid="error-modal" />,
}));

import { render, screen, fireEvent } from '@testing-library/react';

import GuestChangeRequestPage from './GuestChangeRequestPage';

describe('GuestChangeRequestPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.value = {
      data: {
        id: 'po-1',
        poNumber: 'PO-001',
        lineItems: [{ id: 'li-1', materialName: 'Steel Beam' }],
      },
      isLoading: false,
      isError: false,
      error: null,
    };
  });

  it('shows a spinner while loading', () => {
    mockQuery.value = { data: null, isLoading: true, isError: false, error: null };
    render(<GuestChangeRequestPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows an expired-link message on a 403', () => {
    mockQuery.value = { data: null, isLoading: false, isError: true, error: { status: 403 } };
    render(<GuestChangeRequestPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('guest.expiredToken');
  });

  it('renders the change form with the read-only material name', () => {
    render(<GuestChangeRequestPage />);
    expect(screen.getByText('guest.change.title')).toBeInTheDocument();
    expect(screen.getByText('Steel Beam')).toBeInTheDocument();
  });

  it('submits a derived change request via the tokenised endpoint', () => {
    render(<GuestChangeRequestPage />);
    fireEvent.click(screen.getByText('guest.change.submit'));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        changeType: 'COMMERCIAL',
        changedFields: { fields: { paymentTermsDays: { from: 30, to: 45 } } },
      }),
    );
  });
});
