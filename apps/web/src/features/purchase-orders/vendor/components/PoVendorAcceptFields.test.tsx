vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (e: { target: { value: string } }) => void;
    placeholder?: string;
  }) => (
    <input
      data-testid="payment-terms-input"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  ),
  SelectDropdown: ({
    value,
    onChange,
    options,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
  }) => (
    <select data-testid="warehouse-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

import { render, screen, fireEvent } from '@testing-library/react';

import { PoVendorAcceptFields } from './PoVendorAcceptFields';

const warehouses = [
  { id: 'wh-1', name: 'Main Warehouse', address: '123 Main St', city: 'New York' },
  { id: 'wh-2', name: 'Secondary', address: '456 Side St', city: 'Boston' },
] as never[];

describe('PoVendorAcceptFields', () => {
  const onPaymentTermsChange = vi.fn();
  const onWarehouseChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders payment terms input and warehouse select', () => {
    render(
      <PoVendorAcceptFields
        paymentTermsDays=""
        onPaymentTermsChange={onPaymentTermsChange}
        warehouseLocationId=""
        onWarehouseChange={onWarehouseChange}
        warehouseLocations={warehouses}
      />,
    );
    expect(screen.getByTestId('payment-terms-input')).toBeInTheDocument();
    expect(screen.getByTestId('warehouse-select')).toBeInTheDocument();
  });

  it('renders labels for both fields', () => {
    render(
      <PoVendorAcceptFields
        paymentTermsDays=""
        onPaymentTermsChange={onPaymentTermsChange}
        warehouseLocationId=""
        onWarehouseChange={onWarehouseChange}
        warehouseLocations={warehouses}
      />,
    );
    expect(screen.getByText('detailFields.paymentTerms:')).toBeInTheDocument();
    expect(screen.getByText('detailFields.warehouseLocation')).toBeInTheDocument();
  });

  it('calls onPaymentTermsChange with valid numeric input', () => {
    render(
      <PoVendorAcceptFields
        paymentTermsDays=""
        onPaymentTermsChange={onPaymentTermsChange}
        warehouseLocationId=""
        onWarehouseChange={onWarehouseChange}
        warehouseLocations={warehouses}
      />,
    );
    fireEvent.change(screen.getByTestId('payment-terms-input'), {
      target: { value: '30' },
    });
    // The component validates the input pattern internally; the mock Input forwards directly
    expect(onPaymentTermsChange).toHaveBeenCalled();
  });

  it('calls onWarehouseChange when warehouse is selected', () => {
    render(
      <PoVendorAcceptFields
        paymentTermsDays="15"
        onPaymentTermsChange={onPaymentTermsChange}
        warehouseLocationId=""
        onWarehouseChange={onWarehouseChange}
        warehouseLocations={warehouses}
      />,
    );
    fireEvent.change(screen.getByTestId('warehouse-select'), {
      target: { value: 'wh-1' },
    });
    expect(onWarehouseChange).toHaveBeenCalledWith('wh-1');
  });

  it('renders warehouse options from warehouseLocations prop', () => {
    render(
      <PoVendorAcceptFields
        paymentTermsDays=""
        onPaymentTermsChange={onPaymentTermsChange}
        warehouseLocationId=""
        onWarehouseChange={onWarehouseChange}
        warehouseLocations={warehouses}
      />,
    );
    expect(screen.getByText('Main Warehouse — 123 Main St, New York')).toBeInTheDocument();
    expect(screen.getByText('Secondary — 456 Side St, Boston')).toBeInTheDocument();
  });

  it('displays current payment terms value', () => {
    render(
      <PoVendorAcceptFields
        paymentTermsDays="15-30"
        onPaymentTermsChange={onPaymentTermsChange}
        warehouseLocationId=""
        onWarehouseChange={onWarehouseChange}
        warehouseLocations={warehouses}
      />,
    );
    expect(screen.getByTestId('payment-terms-input')).toHaveValue('15-30');
  });

  it('renders with empty warehouse locations', () => {
    render(
      <PoVendorAcceptFields
        paymentTermsDays=""
        onPaymentTermsChange={onPaymentTermsChange}
        warehouseLocationId=""
        onWarehouseChange={onWarehouseChange}
        warehouseLocations={[]}
      />,
    );
    expect(screen.getByTestId('warehouse-select')).toBeInTheDocument();
  });
});
