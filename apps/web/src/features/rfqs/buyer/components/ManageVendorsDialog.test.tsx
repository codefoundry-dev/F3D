import { render, screen, fireEvent } from '@testing-library/react';

const mockUseAssignedVendors = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../services/rfqs.service', () => ({
  useAssignedVendors: mockUseAssignedVendors,
}));

vi.mock('@forethread/ui-components', () => ({
  Modal: ({ children }: any) => <div role="dialog">{children}</div>,
  ModalGridBackground: () => <div data-testid="modal-grid-bg" />,
  ModalHeader: ({ children }: any) => <div>{children}</div>,
  ModalBody: ({ children }: any) => <div>{children}</div>,
  ModalFooter: ({ children }: any) => <div>{children}</div>,
  Alert: ({ children }: any) => <div role="alert">{children}</div>,
  Button: (props: any) => (
    <button
      type="button"
      disabled={props.disabled ?? props.isLoading}
      onClick={props.onClick}
      data-testid={props['data-testid']}
    >
      {props.children}
    </button>
  ),
}));

// Stand-in for the wizard card: exposes the seeded selection count and a toggle
// so we can assert seeding + the exact onSave payload without its internals.
vi.mock('./create/SelectVendorsCard', () => ({
  SelectVendorsCard: ({ selectedVendorIds, selectedRepIds, onChange }: any) => (
    <div data-testid="select-vendors-card">
      <span data-testid="selected-count">{selectedVendorIds.length}</span>
      <span data-testid="selected-rep-count">{selectedRepIds.length}</span>
      <button
        data-testid="toggle-company-3"
        onClick={() =>
          onChange({
            vendorIds: selectedVendorIds.includes('company-3')
              ? selectedVendorIds.filter((id: string) => id !== 'company-3')
              : [...selectedVendorIds, 'company-3'],
            repIds: selectedRepIds,
          })
        }
      >
        toggle
      </button>
      <button
        data-testid="add-rep-9"
        onClick={() =>
          onChange({
            vendorIds: [...new Set([...selectedVendorIds, 'company-3'])],
            repIds: [...selectedRepIds, 'rep-9'],
          })
        }
      >
        add rep
      </button>
    </div>
  ),
}));

import { ManageVendorsDialog } from './ManageVendorsDialog';

const VENDORS = [
  { id: 'a1', companyId: 'company-1', companyName: 'Acme', categories: [], specialisations: [] },
  { id: 'a2', companyId: 'company-2', companyName: 'BuildCo', categories: [], specialisations: [] },
  { id: 'a3', companyId: 'company-3', companyName: 'CemX', categories: [], specialisations: [] },
];

const baseProps = {
  currentVendorIds: ['company-1'],
  currentSalesRepIds: [],
  isSaving: false,
  isError: false,
  onCancel: vi.fn(),
  onSave: vi.fn(),
};

describe('ManageVendorsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAssignedVendors.mockReturnValue({ data: VENDORS, isLoading: false });
  });

  it('seeds the selection from the RFQ’s current vendors', () => {
    render(<ManageVendorsDialog {...baseProps} />);
    expect(screen.getByTestId('selected-count')).toHaveTextContent('1');
  });

  it('adds a vendor and saves the combined company ids', () => {
    const onSave = vi.fn();
    render(<ManageVendorsDialog {...baseProps} onSave={onSave} />);

    fireEvent.click(screen.getByTestId('toggle-company-3'));
    expect(screen.getByTestId('selected-count')).toHaveTextContent('2');

    fireEvent.click(screen.getByTestId('save-vendors'));
    expect(onSave).toHaveBeenCalledWith({
      vendorIds: ['company-1', 'company-3'],
      salesRepIds: [],
    });
  });

  it('seeds chosen reps and saves them as salesRepIds', () => {
    const onSave = vi.fn();
    render(<ManageVendorsDialog {...baseProps} currentSalesRepIds={['rep-1']} onSave={onSave} />);
    expect(screen.getByTestId('selected-rep-count')).toHaveTextContent('1');

    fireEvent.click(screen.getByTestId('add-rep-9'));
    fireEvent.click(screen.getByTestId('save-vendors'));
    expect(onSave).toHaveBeenCalledWith({
      vendorIds: ['company-1', 'company-3'],
      salesRepIds: ['rep-1', 'rep-9'],
    });
  });

  it('disables Save when no vendor is selected', () => {
    render(<ManageVendorsDialog {...baseProps} currentVendorIds={[]} />);
    expect(screen.getByTestId('save-vendors')).toBeDisabled();
  });

  it('shows an error alert when the update failed', () => {
    render(<ManageVendorsDialog {...baseProps} isError />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
