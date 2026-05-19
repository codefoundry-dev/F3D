const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/ui-components', async () => {
  const React = await import('react');
  return {
    Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
      <button onClick={onClick}>{children}</button>
    ),
    onPhoneOnly: vi.fn(),
    onDigitsOnly: vi.fn(),
    onDecimalOnly: vi.fn(),
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

vi.mock('@forethread/api-client', () => ({
  getRfq: vi.fn().mockResolvedValue({ id: 'rfq-1' }),
  getBulkOrder: vi.fn().mockResolvedValue({ id: 'bo-1' }),
}));

vi.mock('@forethread/po-shared', async () => {
  const React = await import('react');
  return {
    SelectRfqModal: ({
      open,
      onClose,
      onSelect,
    }: {
      open: boolean;
      onClose: () => void;
      onSelect: (rfq: { id: string }) => void;
    }) =>
      open
        ? React.createElement(
            'div',
            { 'data-testid': 'select-rfq-modal' },
            React.createElement(
              'button',
              { 'data-testid': 'rfq-close', onClick: onClose },
              'close',
            ),
            React.createElement(
              'button',
              { 'data-testid': 'rfq-select', onClick: () => onSelect({ id: 'rfq-1' }) },
              'select rfq',
            ),
          )
        : null,
    SelectBulkOrderModal: ({
      open,
      onClose,
      onSelect,
    }: {
      open: boolean;
      onClose: () => void;
      onSelect: (bo: { id: string; vendorId: string }) => void;
    }) =>
      open
        ? React.createElement(
            'div',
            { 'data-testid': 'select-bo-modal' },
            React.createElement('button', { 'data-testid': 'bo-close', onClick: onClose }, 'close'),
            React.createElement(
              'button',
              {
                'data-testid': 'bo-select',
                onClick: () => onSelect({ id: 'bo-1', vendorId: 'v-1' }),
              },
              'select bo',
            ),
          )
        : null,
    rfqToFormDefaults: () => ({ defaultValues: {}, lockedFields: [] }),
    bulkOrderToFormDefaults: () => ({ defaultValues: { vendorId: '' }, lockedFields: [] }),
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

import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { QuickActions } from './QuickActions';

describe('QuickActions', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('renders all action buttons', () => {
    render(<QuickActions />);
    expect(screen.getByText('quickActions.createPo')).toBeInTheDocument();
    expect(screen.getByText('quickActions.createRfq')).toBeInTheDocument();
    expect(screen.getByText('quickActions.addVendor')).toBeInTheDocument();
    expect(screen.getByText('quickActions.uploadInvoice')).toBeInTheDocument();
  });

  it('shows PO dropdown and navigates via "Create manually"', () => {
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createPo'));
    // Dropdown is open (mocked as always open), click "Create manually"
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

  it('navigates on other button clicks', () => {
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.addVendor'));
    expect(mockNavigate).toHaveBeenCalledWith('/vendors/new');

    fireEvent.click(screen.getByText('quickActions.uploadInvoice'));
    expect(mockNavigate).toHaveBeenCalledWith('/invoices/upload');
  });

  it('clicks PO dropdown "Converting Approved RFQ" and opens modal', () => {
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createPo'));
    fireEvent.click(screen.getByText('Converting Approved RFQ'));
    expect(screen.getByTestId('select-rfq-modal')).toBeInTheDocument();
  });

  it('selects an RFQ from modal and navigates', async () => {
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createPo'));
    fireEvent.click(screen.getByText('Converting Approved RFQ'));
    fireEvent.click(screen.getByTestId('rfq-select'));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders/new', expect.anything()),
    );
  });

  it('closes RFQ modal via close button', () => {
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createPo'));
    fireEvent.click(screen.getByText('Converting Approved RFQ'));
    fireEvent.click(screen.getByTestId('rfq-close'));
    expect(screen.queryByTestId('select-rfq-modal')).not.toBeInTheDocument();
  });

  it('clicks PO dropdown "From Bulk order" and opens modal', () => {
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createPo'));
    fireEvent.click(screen.getByText('From Bulk order'));
    expect(screen.getByTestId('select-bo-modal')).toBeInTheDocument();
  });

  it('selects a bulk order from modal and navigates', async () => {
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createPo'));
    fireEvent.click(screen.getByText('From Bulk order'));
    fireEvent.click(screen.getByTestId('bo-select'));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders/new', expect.anything()),
    );
  });

  it('closes bulk order modal via close button', () => {
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createPo'));
    fireEvent.click(screen.getByText('From Bulk order'));
    fireEvent.click(screen.getByTestId('bo-close'));
    expect(screen.queryByTestId('select-bo-modal')).not.toBeInTheDocument();
  });

  it('clicks RFQ dropdown "Converting a project BOM" option', () => {
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createRfq'));
    fireEvent.click(screen.getByText('Converting a project BOM'));
  });

  it('clicks RFQ dropdown "From material list" option', () => {
    render(<QuickActions />);
    fireEvent.click(screen.getByText('quickActions.createRfq'));
    fireEvent.click(screen.getByText('From material list'));
  });
});
