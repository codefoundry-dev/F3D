import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import type { FormEvent, ReactNode } from 'react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/api-client', () => ({
  updateLineItem: vi.fn(() => Promise.resolve({})),
}));

vi.mock('@forethread/ui-components', () => ({
  GridModal: ({
    title,
    description,
    children,
    actions,
    onSubmit,
  }: {
    title: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
    actions?: ReactNode;
    onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  }) => (
    <div data-testid="modal">
      <span>{title}</span>
      <span>{description}</span>
      <form onSubmit={onSubmit} noValidate>
        {children}
        {actions}
      </form>
    </div>
  ),
  Input: vi
    .fn()
    .mockImplementation((props: Record<string, unknown>) => (
      <input data-testid={`input-${String(props.type)}`} {...(props as object)} />
    )),
  FormField: ({ children, label }: { children: ReactNode; label: string }) => (
    <div>
      <label>{label}</label>
      {children}
    </div>
  ),
  Button: ({
    children,
    onClick,
    type,
  }: {
    children: ReactNode;
    onClick?: () => void;
    type?: 'submit' | 'button' | 'reset';
  }) => (
    <button onClick={onClick} type={type ?? 'button'}>
      {children}
    </button>
  ),
  Alert: ({ children }: { children: ReactNode }) => <div data-testid="alert">{children}</div>,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/edit.svg?react', () => ({
  default: () => <span />,
}));

import { EditLineItemModal } from './EditLineItemModal';

const lineItem = {
  id: 'li-1',
  materialName: 'Cement',
  quantity: 100,
  unit: 'bags',
  description: 'Portland cement',
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('EditLineItemModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with title', () => {
    render(<EditLineItemModal rfqId="rfq-1" lineItem={lineItem as never} onClose={onClose} />, {
      wrapper,
    });
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('lineItemsTab.editModal.title')).toBeInTheDocument();
  });

  it('renders form fields', () => {
    render(<EditLineItemModal rfqId="rfq-1" lineItem={lineItem as never} onClose={onClose} />, {
      wrapper,
    });
    expect(screen.getByText('lineItemsTab.materialName')).toBeInTheDocument();
    expect(screen.getByText('lineItemsTab.qtyOrdered')).toBeInTheDocument();
    expect(screen.getByText('lineItemsTab.uom')).toBeInTheDocument();
  });

  it('renders submit and cancel buttons', () => {
    render(<EditLineItemModal rfqId="rfq-1" lineItem={lineItem as never} onClose={onClose} />, {
      wrapper,
    });
    expect(screen.getByText('lineItemsTab.editModal.submitChanges')).toBeInTheDocument();
    expect(screen.getByText('common:cancel')).toBeInTheDocument();
  });

  it('calls onClose when cancel clicked', () => {
    render(<EditLineItemModal rfqId="rfq-1" lineItem={lineItem as never} onClose={onClose} />, {
      wrapper,
    });
    fireEvent.click(screen.getByText('common:cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('submits form with mutation', async () => {
    render(<EditLineItemModal rfqId="rfq-1" lineItem={lineItem as never} onClose={onClose} />, {
      wrapper,
    });
    fireEvent.click(screen.getByText('lineItemsTab.editModal.submitChanges'));
    // Mutation fires with updateLineItem
    const { updateLineItem } = await import('@forethread/api-client');
    await vi.waitFor(() => {
      expect(updateLineItem).toHaveBeenCalledWith('rfq-1', 'li-1', {
        materialName: 'Cement',
        quantity: 100,
        unit: 'bags',
        description: 'Portland cement',
      });
    });
  });

  it('updates input values when changed', () => {
    render(<EditLineItemModal rfqId="rfq-1" lineItem={lineItem as never} onClose={onClose} />, {
      wrapper,
    });
    const textInputs = screen.getAllByTestId('input-text');
    // Change material name
    fireEvent.change(textInputs[0], { target: { value: 'Sand' } });
    expect(textInputs[0]).toHaveValue('Sand');
  });

  it('handles description as null in line item', () => {
    const noDescItem = { ...lineItem, description: null } as never;
    render(<EditLineItemModal rfqId="rfq-1" lineItem={noDescItem} onClose={onClose} />, {
      wrapper,
    });
    expect(screen.getByText('lineItemsTab.editModal.title')).toBeInTheDocument();
  });

  it('shows error alert when mutation fails', async () => {
    const { updateLineItem } = await import('@forethread/api-client');
    (updateLineItem as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    render(<EditLineItemModal rfqId="rfq-1" lineItem={lineItem as never} onClose={onClose} />, {
      wrapper,
    });
    fireEvent.click(screen.getByText('lineItemsTab.editModal.submitChanges'));
    await vi.waitFor(() => {
      expect(screen.getByTestId('alert')).toBeInTheDocument();
    });
  });

  it('submits empty description as null', async () => {
    const { updateLineItem } = await import('@forethread/api-client');
    (updateLineItem as ReturnType<typeof vi.fn>).mockResolvedValue({});
    render(<EditLineItemModal rfqId="rfq-1" lineItem={lineItem as never} onClose={onClose} />, {
      wrapper,
    });
    const textInputs = screen.getAllByTestId('input-text');
    fireEvent.change(textInputs[2], { target: { value: '' } });
    fireEvent.click(screen.getByText('lineItemsTab.editModal.submitChanges'));
    await vi.waitFor(() => {
      expect(updateLineItem).toHaveBeenCalledWith(
        'rfq-1',
        'li-1',
        expect.objectContaining({ description: null }),
      );
    });
  });
});
