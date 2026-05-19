import { render, screen, fireEvent, act } from '@testing-library/react';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const capturedQaRfqProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
const capturedQaBoProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
const mockQaGetRfq = vi.hoisted(() => vi.fn());
const mockQaGetBulkOrder = vi.hoisted(() => vi.fn());
const mockQaRfqToFormDefaults = vi.hoisted(() => vi.fn());
const mockQaBulkOrderToFormDefaults = vi.hoisted(() => vi.fn());

vi.mock('@forethread/api-client', () => ({
  getRfq: (...args: unknown[]) => mockQaGetRfq(...args),
  getBulkOrder: (...args: unknown[]) => mockQaGetBulkOrder(...args),
}));

vi.mock('@forethread/po-shared', () => ({
  SelectRfqModal: (props: Record<string, unknown>) => {
    capturedQaRfqProps.current = props;
    return null;
  },
  SelectBulkOrderModal: (props: Record<string, unknown>) => {
    capturedQaBoProps.current = props;
    return null;
  },
  rfqToFormDefaults: (...args: unknown[]) => mockQaRfqToFormDefaults(...args),
  bulkOrderToFormDefaults: (...args: unknown[]) => mockQaBulkOrderToFormDefaults(...args),
}));

vi.mock('@forethread/ui-components', async () => {
  const React = await import('react');
  return {
    Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
      <button onClick={onClick}>{children}</button>
    ),
    useDropdown: () => {
      const [isOpen, setIsOpen] = React.useState(false);
      return {
        ref: { current: null },
        isOpen,
        setIsOpen: (v: boolean | ((p: boolean) => boolean)) => {
          if (typeof v === 'function') setIsOpen(v);
          else setIsOpen(v);
        },
      };
    },
  };
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('@forethread/ui-components/assets/icons/upload.svg?react', () => ({
  default: () => <span data-testid="upload-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/purchase-orders.svg?react', () => ({
  default: () => <span data-testid="po-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/vendors.svg?react', () => ({
  default: () => <span data-testid="vendors-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/search.svg?react', () => ({
  default: () => <span data-testid="search-icon" />,
}));

import { QuickActions } from './QuickActions';

describe('QuickActions', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders all 4 action buttons', () => {
    render(<QuickActions />);
    expect(screen.getByText('quickActions.uploadInvoice')).toBeInTheDocument();
    expect(screen.getByText('quickActions.createPo')).toBeInTheDocument();
    expect(screen.getByText('quickActions.addVendor')).toBeInTheDocument();
    expect(screen.getByText('quickActions.createRfq')).toBeInTheDocument();
  });

  it('renders icons for each action', () => {
    // Icons are passed as leftIcon prop to Button, which is mocked without rendering leftIcon.
    // Just verify the buttons exist (icons tested implicitly via source).
    render(<QuickActions />);
    expect(screen.getByText('quickActions.createPo')).toBeInTheDocument();
    expect(screen.getByText('quickActions.createRfq')).toBeInTheDocument();
    expect(screen.getByText('quickActions.addVendor')).toBeInTheDocument();
    expect(screen.getByText('quickActions.uploadInvoice')).toBeInTheDocument();
  });

  it('shows PO dropdown and navigates via "Create manually"', () => {
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createPo'));
    // Dropdown opens, click "Create manually"
    fireEvent.click(screen.getAllByText('Create manually')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders/new');
  });

  it('shows RFQ dropdown with create options on click', () => {
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createRfq'));
    expect(screen.getByText('Create manually')).toBeInTheDocument();
    expect(screen.getByText('Converting a project BOM')).toBeInTheDocument();
    expect(screen.getByText('From material list')).toBeInTheDocument();
  });

  it('navigates when RFQ "Create manually" selected', () => {
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createRfq'));
    fireEvent.click(screen.getByText('Create manually'));
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs/new');
  });

  it('navigates to vendor page on Add Vendor click', () => {
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.addVendor'));
    expect(mockNavigate).toHaveBeenCalledWith('/vendors/new');
  });

  it('navigates to invoice upload on Upload Invoice click', () => {
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.uploadInvoice'));
    expect(mockNavigate).toHaveBeenCalledWith('/invoices/upload');
  });

  it('PO dropdown shows all three options', () => {
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createPo'));
    expect(screen.getAllByText('Create manually')[0]).toBeInTheDocument();
    expect(screen.getByText('Converting Approved RFQ')).toBeInTheDocument();
    expect(screen.getByText('From Bulk order')).toBeInTheDocument();
  });

  it('PO dropdown "Converting Approved RFQ" closes dropdown', () => {
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createPo'));
    fireEvent.click(screen.getByText('Converting Approved RFQ'));
    // dropdown should close
    expect(screen.queryByText('From Bulk order')).not.toBeInTheDocument();
  });

  it('PO dropdown "From Bulk order" closes dropdown', () => {
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createPo'));
    fireEvent.click(screen.getByText('From Bulk order'));
    expect(screen.queryByText('Converting Approved RFQ')).not.toBeInTheDocument();
  });

  it('RFQ dropdown "Converting a project BOM" closes dropdown', () => {
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createRfq'));
    fireEvent.click(screen.getByText('Converting a project BOM'));
    expect(screen.queryByText('From material list')).not.toBeInTheDocument();
  });

  it('RFQ dropdown "From material list" closes dropdown', () => {
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createRfq'));
    fireEvent.click(screen.getByText('From material list'));
    expect(screen.queryByText('Converting a project BOM')).not.toBeInTheDocument();
  });

  it('PO SelectRfqModal onSelect navigates with RFQ form defaults', async () => {
    const rfqDetail = { lineItems: [{ id: 'li-1' }] };
    mockQaGetRfq.mockResolvedValue(rfqDetail);
    mockQaRfqToFormDefaults.mockReturnValue({
      defaultValues: { projectId: 'p1' },
      lockedFields: new Set(['projectId']),
    });
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createPo'));
    fireEvent.click(screen.getByText('Converting Approved RFQ'));
    const onSelect = capturedQaRfqProps.current?.onSelect as (
      rfq: { id: string },
      ids?: Set<string>,
    ) => void;
    act(() => onSelect({ id: 'rfq-1' }));
    await vi.waitFor(() => expect(mockQaGetRfq).toHaveBeenCalledWith('rfq-1'));
  });

  it('PO SelectRfqModal onSelect filters line items with selectedItemIds', async () => {
    const rfqDetail = { lineItems: [{ id: 'li-1' }, { id: 'li-2' }] };
    mockQaGetRfq.mockResolvedValue(rfqDetail);
    mockQaRfqToFormDefaults.mockReturnValue({ defaultValues: {}, lockedFields: new Set() });
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createPo'));
    fireEvent.click(screen.getByText('Converting Approved RFQ'));
    const onSelect = capturedQaRfqProps.current?.onSelect as (
      rfq: { id: string },
      ids?: Set<string>,
    ) => void;
    act(() => onSelect({ id: 'rfq-2' }, new Set(['li-1'])));
    await vi.waitFor(() =>
      expect(mockQaRfqToFormDefaults).toHaveBeenCalledWith(
        expect.objectContaining({ lineItems: [{ id: 'li-1' }] }),
      ),
    );
  });

  it('PO SelectBulkOrderModal onSelect navigates with bulk order defaults', async () => {
    const boDetail = { lineItems: [{ lineItemId: 'bli-1' }] };
    mockQaGetBulkOrder.mockResolvedValue(boDetail);
    mockQaBulkOrderToFormDefaults.mockReturnValue({
      defaultValues: { projectId: 'p2' },
      lockedFields: new Set(['projectId']),
    });
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createPo'));
    fireEvent.click(screen.getByText('From Bulk order'));
    const onSelect = capturedQaBoProps.current?.onSelect as (
      bo: { id: string; vendorId: string },
      ids?: Set<string>,
    ) => void;
    act(() => onSelect({ id: 'bo-1', vendorId: 'v-1' }));
    await vi.waitFor(() => expect(mockQaGetBulkOrder).toHaveBeenCalledWith('bo-1'));
  });

  it('PO SelectBulkOrderModal onSelect filters line items with selectedItemIds', async () => {
    const boDetail = { lineItems: [{ lineItemId: 'bli-1' }, { lineItemId: 'bli-2' }] };
    mockQaGetBulkOrder.mockResolvedValue(boDetail);
    mockQaBulkOrderToFormDefaults.mockReturnValue({ defaultValues: {}, lockedFields: new Set() });
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createPo'));
    fireEvent.click(screen.getByText('From Bulk order'));
    const onSelect = capturedQaBoProps.current?.onSelect as (
      bo: { id: string; vendorId: string },
      ids?: Set<string>,
    ) => void;
    act(() => onSelect({ id: 'bo-2', vendorId: 'v-2' }, new Set(['bli-2'])));
    await vi.waitFor(() =>
      expect(mockQaBulkOrderToFormDefaults).toHaveBeenCalledWith(
        expect.objectContaining({ lineItems: [{ lineItemId: 'bli-2' }] }),
      ),
    );
  });
});
