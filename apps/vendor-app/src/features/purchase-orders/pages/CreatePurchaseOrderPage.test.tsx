import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockCreateMutate = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/po-shared', () => ({
  Stepper: ({ step, labels }: { step: number; labels: string[] }) => (
    <div data-testid="stepper" data-step={step}>
      {labels.join(',')}
    </div>
  ),
  PoBasicInfoStep: () => <div data-testid="basic-info-step" />,
  PoCreateLineItemsStep: () => <div data-testid="line-items-step" />,
  PoReviewStep: ({ register }: { register: unknown }) => (
    <div data-testid="review-step">{register ? 'has-register' : ''}</div>
  ),
  formSchema: {
    parse: vi.fn(),
  },
  EMPTY_LINE_ITEM: {
    materialCode: '',
    description: '',
    quantityOrdered: 1,
    unitOfMeasure: '',
    unitPrice: 0,
    costCode: '',
    notes: '',
    expectedDeliveryDate: '',
    deliveryLocationId: '',
  },
}));

vi.mock('@forethread/shared-types/client', () => ({
  PoType: { STANDARD: 'STANDARD', HOLD_FOR_RELEASE: 'HOLD_FOR_RELEASE' },
}));

vi.mock('@forethread/ui-components', () => ({
  Button: ({
    children,
    onClick,
    type,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    type?: string;
  }) => (
    <button type={type as 'button' | 'submit'} onClick={onClick}>
      {children}
    </button>
  ),
  notificationService: { error: vi.fn() },
  StatusSuccessModal: ({ onClose, title }: { onClose: () => void; title: string }) => (
    <div data-testid="success-modal">
      <span>{title}</span>
      <button onClick={onClose}>close-success</button>
    </div>
  ),
  StatusErrorModal: ({
    onClose,
    onPrimaryClick,
    onSecondaryClick,
    title,
  }: {
    onClose: () => void;
    onPrimaryClick: () => void;
    onSecondaryClick: () => void;
    title: string;
  }) => (
    <div data-testid="error-modal">
      <span>{title}</span>
      <button onClick={onClose}>close-error</button>
      <button onClick={onPrimaryClick}>try-again</button>
      <button onClick={onSecondaryClick}>save-draft-error</button>
    </div>
  ),
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => (values: Record<string, unknown>) => ({
    values,
    errors: {},
  }),
}));

vi.mock('../services/purchase-orders.service', () => ({
  useProjectsList: () => ({
    data: { items: [{ id: 'p1', name: 'Project A' }] },
  }),
  useProjectDetail: () => ({
    data: {
      id: 'p1',
      currency: 'AUD',
      locations: [{ id: 'l1', type: 'DELIVERY', label: 'Site A', address: '123 St' }],
    },
  }),
  useCompanyVendors: () => ({
    data: [{ id: 'v1', legalName: 'Vendor A' }],
  }),
  useCreatePurchaseOrder: () => ({
    mutate: mockCreateMutate,
    isPending: false,
  }),
}));

import CreatePurchaseOrderPage from './CreatePurchaseOrderPage';

const renderPage = () =>
  render(
    <MemoryRouter>
      <CreatePurchaseOrderPage />
    </MemoryRouter>,
  );

describe('CreatePurchaseOrderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMutate.mockImplementation((_input: unknown, opts: { onSuccess?: () => void }) => {
      opts.onSuccess?.();
    });
  });

  it('renders stepper at step 1', () => {
    renderPage();
    expect(screen.getByTestId('stepper')).toHaveAttribute('data-step', '1');
  });

  it('renders basic info step initially', () => {
    renderPage();
    expect(screen.getByTestId('basic-info-step')).toBeInTheDocument();
  });

  it('renders continue button on step 1', () => {
    renderPage();
    expect(screen.getByText(/create\.continue/)).toBeInTheDocument();
  });

  it('renders save draft button', () => {
    renderPage();
    expect(screen.getByText('create.saveDraft')).toBeInTheDocument();
  });

  it('renders back button', () => {
    renderPage();
    expect(screen.getByText(/create\.back/)).toBeInTheDocument();
  });

  it('clicking back on step 1 navigates away', () => {
    renderPage();
    fireEvent.click(screen.getByText(/create\.back/));
    expect(mockNavigate).toHaveBeenCalled();
  });

  it('renders step labels from translations', () => {
    renderPage();
    expect(screen.getByTestId('stepper').textContent).toContain('create.stepLabel1');
  });

  it('clicking continue on step 1 advances to step 2 when valid', async () => {
    renderPage();
    fireEvent.click(screen.getByText(/create\.continue/));
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-step', '2');
    });
  });

  it('clicking continue on step 2 advances to step 3 when valid', async () => {
    renderPage();
    // Go to step 2
    fireEvent.click(screen.getByText(/create\.continue/));
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-step', '2');
    });
    // Go to step 3
    fireEvent.click(screen.getByText(/create\.continue/));
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-step', '3');
    });
  });

  it('renders submit button on step 3', async () => {
    renderPage();
    fireEvent.click(screen.getByText(/create\.continue/));
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-step', '2');
    });
    fireEvent.click(screen.getByText(/create\.continue/));
    await waitFor(() => {
      expect(screen.getByText(/create\.submitPo/)).toBeInTheDocument();
    });
  });

  it('clicking back on step 2 goes back to step 1', async () => {
    renderPage();
    fireEvent.click(screen.getByText(/create\.continue/));
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-step', '2');
    });
    fireEvent.click(screen.getByText(/create\.back/));
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-step', '1');
    });
  });

  it('shows success modal after successful submission', async () => {
    renderPage();
    // Navigate to step 3
    fireEvent.click(screen.getByText(/create\.continue/));
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-step', '2');
    });
    fireEvent.click(screen.getByText(/create\.continue/));
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-step', '3');
    });
    // Submit the form
    fireEvent.click(screen.getByText(/create\.submitPo/));
    await waitFor(() => {
      expect(screen.getByTestId('success-modal')).toBeInTheDocument();
    });
  });

  it('closing success modal navigates to PO list', async () => {
    renderPage();
    fireEvent.click(screen.getByText(/create\.continue/));
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-step', '2');
    });
    fireEvent.click(screen.getByText(/create\.continue/));
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-step', '3');
    });
    fireEvent.click(screen.getByText(/create\.submitPo/));
    await waitFor(() => {
      expect(screen.getByTestId('success-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('close-success'));
    expect(mockNavigate).toHaveBeenCalled();
  });

  it('shows error modal when submission fails', async () => {
    mockCreateMutate.mockImplementation((_input: unknown, opts: { onError?: () => void }) => {
      opts.onError?.();
    });
    renderPage();
    fireEvent.click(screen.getByText(/create\.continue/));
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-step', '2');
    });
    fireEvent.click(screen.getByText(/create\.continue/));
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-step', '3');
    });
    fireEvent.click(screen.getByText(/create\.submitPo/));
    await waitFor(() => {
      expect(screen.getByTestId('error-modal')).toBeInTheDocument();
    });
  });

  it('closing error modal hides it', async () => {
    mockCreateMutate.mockImplementation((_input: unknown, opts: { onError?: () => void }) => {
      opts.onError?.();
    });
    renderPage();
    fireEvent.click(screen.getByText(/create\.continue/));
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-step', '2');
    });
    fireEvent.click(screen.getByText(/create\.continue/));
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-step', '3');
    });
    fireEvent.click(screen.getByText(/create\.submitPo/));
    await waitFor(() => {
      expect(screen.getByTestId('error-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('close-error'));
    expect(screen.queryByTestId('error-modal')).not.toBeInTheDocument();
  });

  it('try again in error modal retries submission', async () => {
    let callCount = 0;
    mockCreateMutate.mockImplementation(
      (_input: unknown, opts: { onSuccess?: () => void; onError?: () => void }) => {
        callCount++;
        if (callCount === 1) opts.onError?.();
        else opts.onSuccess?.();
      },
    );
    renderPage();
    fireEvent.click(screen.getByText(/create\.continue/));
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-step', '2');
    });
    fireEvent.click(screen.getByText(/create\.continue/));
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-step', '3');
    });
    fireEvent.click(screen.getByText(/create\.submitPo/));
    await waitFor(() => {
      expect(screen.getByTestId('error-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('try-again'));
    await waitFor(() => {
      expect(callCount).toBe(2);
    });
  });

  it('save draft in error modal retries as draft', async () => {
    let callCount = 0;
    mockCreateMutate.mockImplementation(
      (_input: unknown, opts: { onSuccess?: () => void; onError?: () => void }) => {
        callCount++;
        if (callCount === 1) opts.onError?.();
        else opts.onSuccess?.();
      },
    );
    renderPage();
    fireEvent.click(screen.getByText(/create\.continue/));
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-step', '2');
    });
    fireEvent.click(screen.getByText(/create\.continue/));
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-step', '3');
    });
    fireEvent.click(screen.getByText(/create\.submitPo/));
    await waitFor(() => {
      expect(screen.getByTestId('error-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('save-draft-error'));
    await waitFor(() => {
      expect(callCount).toBe(2);
    });
  });

  it('save draft button on step 1 triggers form submission', async () => {
    renderPage();
    fireEvent.click(screen.getByText('create.saveDraft'));
    await waitFor(() => {
      expect(mockCreateMutate).toHaveBeenCalled();
    });
  });

  it('renders review step with register prop on step 3', async () => {
    renderPage();
    fireEvent.click(screen.getByText(/create\.continue/));
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-step', '2');
    });
    fireEvent.click(screen.getByText(/create\.continue/));
    await waitFor(() => {
      expect(screen.getByTestId('review-step')).toBeInTheDocument();
      expect(screen.getByTestId('review-step').textContent).toContain('has-register');
    });
  });
});
