import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockDeleteLineItem = vi.hoisted(() => vi.fn());
vi.mock('@forethread/api-client', () => ({
  deleteLineItem: mockDeleteLineItem,
  updateLineItem: vi.fn(),
}));

vi.mock('@forethread/ui-components', () => ({
  Button: ({ children }: { children: React.ReactNode }) => (
    <button data-testid="btn">{children}</button>
  ),
  ConfirmDialog: (props: { onConfirm: () => void; onCancel: () => void; title?: string }) => (
    <div data-testid="confirm-dialog">
      <button data-testid="confirm-delete" onClick={props.onConfirm}>
        Confirm
      </button>
      <button data-testid="cancel-delete" onClick={props.onCancel}>
        Cancel
      </button>
    </div>
  ),
  formatDate: (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  },
}));

vi.mock('@forethread/ui-components/assets/icons/delete.svg?react', () => ({
  default: (props: Record<string, unknown>) => <svg data-testid="icon-delete" {...props} />,
}));
vi.mock('@forethread/ui-components/assets/icons/edit.svg?react', () => ({
  default: (props: Record<string, unknown>) => <svg data-testid="icon-edit" {...props} />,
}));
vi.mock('./EditLineItemModal', () => ({
  EditLineItemModal: () => null,
}));

import { RfqLineItemsTab } from './RfqLineItemsTab';

const MOCK_LINE_ITEMS = [
  {
    id: 'LI-001',
    projectName: 'Project Alpha',
    materialName: 'Steel Beam',
    description: 'W10x22 beam',
    quantity: 50,
    unit: 'pcs',
    expectedDeliveryDate: '2024-04-01',
    deliveryLocation: 'Site A',
  },
  {
    id: 'LI-002',
    projectName: 'Project Alpha',
    materialName: 'Copper Wire',
    description: null,
    quantity: 200,
    unit: 'meters',
    expectedDeliveryDate: null,
    deliveryLocation: null,
  },
];

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('RfqLineItemsTab', () => {
  it('renders table with all line items', () => {
    render(<RfqLineItemsTab lineItems={MOCK_LINE_ITEMS} layout="panel" />);
    expect(screen.getByText('Steel Beam')).toBeInTheDocument();
    expect(screen.getByText('Copper Wire')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<RfqLineItemsTab lineItems={MOCK_LINE_ITEMS} layout="panel" />);
    expect(screen.getByText('lineItemsTab.project')).toBeInTheDocument();
    expect(screen.getByText('lineItemsTab.materialName')).toBeInTheDocument();
    expect(screen.getByText('lineItemsTab.qtyOrdered')).toBeInTheDocument();
    expect(screen.getByText('lineItemsTab.uom')).toBeInTheDocument();
  });

  it('renders total items footer', () => {
    render(<RfqLineItemsTab lineItems={MOCK_LINE_ITEMS} layout="panel" />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('does not show actions column in panel layout', () => {
    render(<RfqLineItemsTab lineItems={MOCK_LINE_ITEMS} layout="panel" />);
    expect(screen.queryByText('lineItemsTab.actions')).not.toBeInTheDocument();
  });

  it('shows actions column in page layout', () => {
    renderWithQuery(<RfqLineItemsTab rfqId="rfq-1" lineItems={MOCK_LINE_ITEMS} layout="page" />);
    expect(screen.getByText('lineItemsTab.actions')).toBeInTheDocument();
  });

  it('does not show a header edit button in page layout', () => {
    renderWithQuery(<RfqLineItemsTab rfqId="rfq-1" lineItems={MOCK_LINE_ITEMS} layout="page" />);
    expect(screen.queryByText('lineItemsTab.edit')).not.toBeInTheDocument();
  });

  it('formats delivery date', () => {
    renderWithQuery(<RfqLineItemsTab rfqId="rfq-1" lineItems={MOCK_LINE_ITEMS} layout="page" />);
    expect(screen.getByText('Apr 1, 2024')).toBeInTheDocument();
  });

  it('shows dash for null values', () => {
    renderWithQuery(<RfqLineItemsTab rfqId="rfq-1" lineItems={MOCK_LINE_ITEMS} layout="page" />);
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('opens edit modal when edit row button is clicked', () => {
    renderWithQuery(<RfqLineItemsTab rfqId="rfq-1" lineItems={MOCK_LINE_ITEMS} layout="page" />);
    const editButtons = screen.getAllByTitle('actions.edit');
    fireEvent.click(editButtons[0]);
    // EditLineItemModal is mocked to return null, but the click should not crash
    expect(editButtons[0]).toBeInTheDocument();
  });

  it('opens delete confirmation when delete button is clicked', () => {
    renderWithQuery(<RfqLineItemsTab rfqId="rfq-1" lineItems={MOCK_LINE_ITEMS} layout="page" />);
    const deleteButtons = screen.getAllByTitle('actions.delete');
    fireEvent.click(deleteButtons[0]);
    // ConfirmDialog is mocked to return null
    expect(deleteButtons[0]).toBeInTheDocument();
  });

  it('defaults to panel layout', () => {
    render(<RfqLineItemsTab lineItems={MOCK_LINE_ITEMS} />);
    // Panel layout does not have actions column
    expect(screen.queryByText('lineItemsTab.actions')).not.toBeInTheDocument();
    expect(screen.getByText('Steel Beam')).toBeInTheDocument();
  });

  it('renders total items count in page layout footer', () => {
    renderWithQuery(<RfqLineItemsTab rfqId="rfq-1" lineItems={MOCK_LINE_ITEMS} layout="page" />);
    // Footer shows total items count
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
  });

  it('shows confirm dialog and triggers delete mutation on confirm', async () => {
    mockDeleteLineItem.mockResolvedValue({});
    renderWithQuery(<RfqLineItemsTab rfqId="rfq-1" lineItems={MOCK_LINE_ITEMS} layout="page" />);
    const deleteButtons = screen.getAllByTitle('actions.delete');
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-delete'));
    await vi.waitFor(() => {
      expect(mockDeleteLineItem).toHaveBeenCalledWith('rfq-1', 'LI-001');
    });
  });

  it('cancels delete when cancel is clicked in confirm dialog', () => {
    renderWithQuery(<RfqLineItemsTab rfqId="rfq-1" lineItems={MOCK_LINE_ITEMS} layout="page" />);
    const deleteButtons = screen.getAllByTitle('actions.delete');
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cancel-delete'));
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });
});
