/* eslint-disable @typescript-eslint/no-explicit-any */
const mockMutate = vi.hoisted(() => vi.fn());
const mockSuccess = vi.hoisted(() => vi.fn());
const mockError = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

vi.mock('../services/bulk-orders.service', () => ({
  useProposeChange: () => ({ mutate: mockMutate, isPending: false }),
}));

vi.mock('@forethread/ui-components', () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  Button: ({ children, onClick, disabled, type }: any) => (
    <button onClick={onClick} disabled={disabled} type={type ?? 'button'}>
      {children}
    </button>
  ),
  DatePicker: ({ value, onChange }: any) => (
    <input
      data-testid="date-picker"
      value={value}
      onChange={(e: any) => onChange(e.target.value)}
    />
  ),
  FormField: ({ label, children }: any) => (
    <label>
      {label}
      {children}
    </label>
  ),
  GridModal: ({ icon, title, description, children, actions, onSubmit }: any) => (
    <div data-testid="modal">
      <span data-testid="icon-badge">{icon}</span>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {onSubmit ? (
        <form onSubmit={onSubmit}>
          {children}
          {actions}
        </form>
      ) : (
        <>
          {children}
          {actions}
        </>
      )}
    </div>
  ),
  Textarea: ({ value, onChange, placeholder }: any) => (
    <textarea
      data-testid="message"
      value={value}
      placeholder={placeholder}
      onChange={(e: any) => onChange(e)}
    />
  ),
  formatDate: (d: string) => `formatted(${d})`,
  notificationService: { success: mockSuccess, error: mockError },
}));

vi.mock('@forethread/ui-components/assets/icons/clock.svg?react', () => ({
  default: () => <span data-testid="clock-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/info-in-triangle.svg?react', () => ({
  default: () => <span data-testid="info-icon" />,
}));

import { fireEvent, render, screen } from '@testing-library/react';

import { ProposeExtensionModal } from './ProposeExtensionModal';

const onClose = vi.fn();

beforeEach(() => {
  mockMutate.mockReset();
  onClose.mockReset();
});

function renderModal() {
  return render(
    <ProposeExtensionModal
      bulkOrderId="bo-1"
      bulkNumber="BULK-2025-011"
      currentValidUntil="2025-01-15T00:00:00Z"
      onClose={onClose}
    />,
  );
}

describe('ProposeExtensionModal', () => {
  it('renders the title with the bulk number and the warning with the valid-until date', () => {
    renderModal();
    expect(screen.getByText(/extension\.title.*BULK-2025-011/)).toBeInTheDocument();
    expect(screen.getByText(/extension\.warning.*formatted/)).toBeInTheDocument();
  });

  it('disables Send to vendor until a new end date is entered', () => {
    renderModal();
    const send = screen.getByText('extension.sendToVendor');
    expect(send).toBeDisabled();

    fireEvent.change(screen.getByTestId('date-picker'), { target: { value: '2025-03-01' } });
    expect(screen.getByText('extension.sendToVendor')).not.toBeDisabled();
  });

  it('submits an endDate-only change request with the optional message', () => {
    renderModal();
    fireEvent.change(screen.getByTestId('date-picker'), { target: { value: '2025-03-01' } });
    fireEvent.change(screen.getByTestId('message'), { target: { value: 'Project delayed' } });
    fireEvent.click(screen.getByText('extension.sendToVendor'));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0][0]).toEqual({
      bulkOrderId: 'bo-1',
      input: { endDate: '2025-03-01', message: 'Project delayed' },
    });
  });

  it('closes when Cancel is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByText('extension.cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
