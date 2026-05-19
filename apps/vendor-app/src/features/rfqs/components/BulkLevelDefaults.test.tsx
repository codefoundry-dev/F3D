import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
  }) => <button onClick={onClick}>{children}</button>,
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  DatePicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input data-testid="date-picker" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
  Input: ({
    value,
    onChange,
    placeholder,
    disabled,
  }: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    disabled?: boolean;
    type?: string;
    inputMode?: string;
    onKeyDown?: (e: React.KeyboardEvent) => void;
  }) => <input value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} />,
  onDecimalOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  CustomDropdown: ({
    options,
    value,
    onChange,
    placeholder,
    disabled,
    actionItem,
  }: {
    options: { value: string; label: string }[];
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    actionItem?: { label: string; onClick: () => void };
  }) => (
    <div data-testid="warehouse-dropdown">
      <button data-testid="warehouse-dropdown-trigger" disabled={disabled} onClick={() => {}}>
        {value
          ? options.find((o: { value: string; label: string }) => o.value === value)?.label
          : placeholder}
      </button>
      {options.map((o: { value: string; label: string }) => (
        <button key={o.value} onClick={() => onChange?.(o.value)}>
          {o.label}
        </button>
      ))}
      {actionItem && <button onClick={actionItem.onClick}>{actionItem.label}</button>}
    </div>
  ),
}));

vi.mock('@forethread/ui-components/assets/icons/chevron-down.svg?react', () => ({
  default: () => <span />,
}));

import type { BulkDefaults } from '../hooks/useRfqResponse';

import { BulkLevelDefaults } from './BulkLevelDefaults';

const defaultBulkDefaults: BulkDefaults = {
  bulkAvailability: '',
  bulkDiscount: '',
  bulkTax: '',
  shipment: '',
  warehouseLocationId: '',
  bulkDeliveryTime: '',
};

describe('BulkLevelDefaults', () => {
  const onFieldChange = vi.fn();
  const onToggleExpanded = vi.fn();

  const baseProps = {
    bulkDefaults: defaultBulkDefaults,
    onFieldChange,
    expanded: false,
    onToggleExpanded,
    warehouses: [] as {
      id: string;
      name: string;
      city: string;
      postcode: string;
      address: string;
    }[],
    warehousesLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header with title and subtitle', () => {
    render(<BulkLevelDefaults {...baseProps} />);
    expect(screen.getByText('response.bulkDefaults')).toBeInTheDocument();
    expect(screen.getByText('response.appliedToAll')).toBeInTheDocument();
  });

  it('renders expand button when collapsed', () => {
    render(<BulkLevelDefaults {...baseProps} />);
    expect(screen.getByText('response.expand')).toBeInTheDocument();
  });

  it('renders collapse button when expanded', () => {
    render(<BulkLevelDefaults {...baseProps} expanded />);
    expect(screen.getByText('response.collapse')).toBeInTheDocument();
  });

  it('calls onToggleExpanded when toggle button is clicked', () => {
    render(<BulkLevelDefaults {...baseProps} />);
    fireEvent.click(screen.getByText('response.expand'));
    expect(onToggleExpanded).toHaveBeenCalledWith(true);
  });

  it('does not render form fields when collapsed', () => {
    render(<BulkLevelDefaults {...baseProps} />);
    expect(screen.queryByText('response.bulkAvailability')).not.toBeInTheDocument();
  });

  it('renders form fields when expanded', () => {
    render(<BulkLevelDefaults {...baseProps} expanded />);
    expect(screen.getByText('response.bulkAvailability')).toBeInTheDocument();
    expect(screen.getByText('response.bulkDiscount')).toBeInTheDocument();
    expect(screen.getByText('response.generalSalesTax')).toBeInTheDocument();
    expect(screen.getByText('response.shipment')).toBeInTheDocument();
    expect(screen.getByText('response.warehouseLocation')).toBeInTheDocument();
    expect(screen.getByText('response.bulkDeliveryDateTime')).toBeInTheDocument();
  });

  it('renders warehouse select with options', () => {
    const warehouses = [
      { id: 'wh-1', name: 'Warehouse 1', city: 'Sydney', postcode: '2000', address: '1 Main St' },
      {
        id: 'wh-2',
        name: 'Warehouse 2',
        city: 'Melbourne',
        postcode: '3000',
        address: '2 High St',
      },
    ];
    render(<BulkLevelDefaults {...baseProps} expanded warehouses={warehouses} />);
    expect(screen.getByText('1 Main St, Sydney, Warehouse 1, 2000')).toBeInTheDocument();
    expect(screen.getByText('2 High St, Melbourne, Warehouse 2, 3000')).toBeInTheDocument();
  });

  it('renders add new warehouse option when onAddWarehouse is provided', () => {
    const onAddWarehouse = vi.fn();
    render(<BulkLevelDefaults {...baseProps} expanded onAddWarehouse={onAddWarehouse} />);
    expect(screen.getByText('+ response.addNewWarehouse')).toBeInTheDocument();
  });

  it('calls onAddWarehouse when action item is clicked', () => {
    const onAddWarehouse = vi.fn();
    render(<BulkLevelDefaults {...baseProps} expanded onAddWarehouse={onAddWarehouse} />);
    fireEvent.click(screen.getByText('+ response.addNewWarehouse'));
    expect(onAddWarehouse).toHaveBeenCalled();
  });

  it('calls onFieldChange when warehouse is selected', () => {
    const warehouses = [
      { id: 'wh-1', name: 'Warehouse 1', city: 'Sydney', postcode: '2000', address: '1 Main St' },
    ];
    render(<BulkLevelDefaults {...baseProps} expanded warehouses={warehouses} />);
    fireEvent.click(screen.getByText('1 Main St, Sydney, Warehouse 1, 2000'));
    expect(onFieldChange).toHaveBeenCalledWith('warehouseLocationId', 'wh-1');
  });

  it('disables warehouse dropdown when loading', () => {
    render(<BulkLevelDefaults {...baseProps} expanded warehousesLoading />);
    expect(screen.getByTestId('warehouse-dropdown-trigger')).toBeDisabled();
  });
});
