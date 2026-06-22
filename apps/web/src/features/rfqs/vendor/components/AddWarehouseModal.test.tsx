import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/api-client', () => ({
  searchAddresses: vi.fn(() => Promise.resolve([])),
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
  }) => <input value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} />,
  AddressInput: ({
    value,
    onChange,
    placeholder,
    disabled,
  }: {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    disabled?: boolean;
    searchFn?: unknown;
    types?: string[];
    locationContext?: string;
  }) => (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
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
}));

vi.mock('@forethread/ui-components/assets/icons/location.svg?react', () => ({
  default: () => <span />,
}));

import { AddWarehouseModal } from './AddWarehouseModal';

describe('AddWarehouseModal', () => {
  const onClose = vi.fn();
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal with title and subtitle', () => {
    render(<AddWarehouseModal onClose={onClose} onSubmit={onSubmit} />);
    expect(screen.getByText('response.addWarehouseTitle')).toBeInTheDocument();
    expect(screen.getByText('response.addWarehouseSubtitle')).toBeInTheDocument();
  });

  it('renders all input fields', () => {
    render(<AddWarehouseModal onClose={onClose} onSubmit={onSubmit} />);
    // Country, city, address use AddressInput; postcode uses Input
    expect(screen.getByPlaceholderText('response.warehouseCountryPlaceholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('response.warehouseCityPlaceholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('response.warehouseAddressPlaceholder')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('response.warehousePostcodePlaceholder'),
    ).toBeInTheDocument();
  });

  it('renders cancel and add buttons', () => {
    render(<AddWarehouseModal onClose={onClose} onSubmit={onSubmit} />);
    expect(screen.getByText('response.cancel')).toBeInTheDocument();
    expect(screen.getByText('response.addWarehouse')).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', () => {
    render(<AddWarehouseModal onClose={onClose} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText('response.cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('submit button is disabled when required fields are empty', () => {
    render(<AddWarehouseModal onClose={onClose} onSubmit={onSubmit} />);
    const submitBtn = screen.getByText('response.addWarehouse');
    expect(submitBtn).toBeDisabled();
  });

  it('does not call onSubmit when clicking submit with empty fields', () => {
    render(<AddWarehouseModal onClose={onClose} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText('response.addWarehouse'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with trimmed values when valid', () => {
    render(<AddWarehouseModal onClose={onClose} onSubmit={onSubmit} />);
    // Fill country first (enables city)
    fireEvent.change(screen.getByPlaceholderText('response.warehouseCountryPlaceholder'), {
      target: { value: ' Australia ' },
    });
    // Fill city (enables address & postcode)
    fireEvent.change(screen.getByPlaceholderText('response.warehouseCityPlaceholder'), {
      target: { value: ' Melbourne ' },
    });
    // Fill address
    fireEvent.change(screen.getByPlaceholderText('response.warehouseAddressPlaceholder'), {
      target: { value: ' 123 Main St ' },
    });
    // Fill postcode
    fireEvent.change(screen.getByPlaceholderText('response.warehousePostcodePlaceholder'), {
      target: { value: ' 3000 ' },
    });
    fireEvent.click(screen.getByText('response.addWarehouse'));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Australia',
      address: '123 Main St',
      city: 'Melbourne',
      postcode: '3000',
    });
  });

  it('shows submitting text when isSubmitting is true', () => {
    render(<AddWarehouseModal onClose={onClose} onSubmit={onSubmit} isSubmitting />);
    expect(screen.getByText('response.adding')).toBeInTheDocument();
  });

  it('disables submit button when isSubmitting is true', () => {
    render(<AddWarehouseModal onClose={onClose} onSubmit={onSubmit} isSubmitting />);
    expect(screen.getByText('response.adding')).toBeDisabled();
  });
});
