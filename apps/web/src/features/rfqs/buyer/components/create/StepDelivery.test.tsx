import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/ui-components', () => ({
  Checkbox: (props: any) => (
    <label>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e: any) => props.onChange?.(e.target.checked)}
      />
      {props.label}
    </label>
  ),
  CustomDropdown: (props: any) => (
    <select
      aria-label={props.placeholder}
      value={props.value ?? ''}
      onChange={(e: any) => props.onChange?.(e.target.value)}
    >
      <option value="">{props.placeholder}</option>
      {props.options.map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
  DatePicker: (props: any) => (
    <input
      type="date"
      aria-label="date"
      value={props.value ?? ''}
      onChange={(e: any) => props.onChange?.(e.target.value)}
    />
  ),
  Textarea: (props: any) => <textarea {...props} />,
  FormField: ({ children, label, error }: any) => (
    <div>
      <label>{label}</label>
      {children}
      {error && <span data-testid="error">{error}</span>}
    </div>
  ),
}));

import { StepDelivery, type DeliveryStepValues } from './StepDelivery';

const locations = [{ id: 'l1', type: 'DELIVERY', address: '1 Build St', label: 'Site' }] as any;

function renderStep(values: Partial<DeliveryStepValues> = {}, onChange = vi.fn()) {
  render(
    <StepDelivery
      locations={locations}
      values={{ deadlineEnd: '', deliveryLocationId: '', ...values }}
      onChange={onChange}
    />,
  );
  return onChange;
}

describe('StepDelivery', () => {
  it('renders the heading and the delivery location options', () => {
    renderStep();
    expect(screen.getByText('Delivery & specs')).toBeInTheDocument();
    expect(screen.getByText('Site — 1 Build St')).toBeInTheDocument();
  });

  it('converts a chosen deadline date into an ISO datetime', () => {
    const onChange = renderStep();
    const dateInputs = screen.getAllByLabelText('date');
    fireEvent.change(dateInputs[0], { target: { value: '2030-01-15' } });
    expect(onChange).toHaveBeenCalledWith({ deadlineEnd: '2030-01-15T00:00:00.000Z' });
  });

  it('emits the chosen delivery location id', () => {
    const onChange = renderStep();
    fireEvent.change(screen.getByLabelText(/select a delivery location/i), {
      target: { value: 'l1' },
    });
    expect(onChange).toHaveBeenCalledWith({ deliveryLocationId: 'l1' });
  });

  it('reveals the earliest delivery date field when hold-for-release is on', () => {
    renderStep({ holdForRelease: true });
    expect(screen.getByText('Earliest delivery date')).toBeInTheDocument();
  });

  it('hides the earliest delivery date field when hold-for-release is off', () => {
    renderStep({ holdForRelease: false });
    expect(screen.queryByText('Earliest delivery date')).not.toBeInTheDocument();
  });

  it('clears earliestDeliveryDate when hold-for-release is toggled off', () => {
    const onChange = renderStep({ holdForRelease: true, earliestDeliveryDate: '2030-02-01T00:00:00.000Z' });
    fireEvent.click(screen.getByLabelText('Hold for release'));
    expect(onChange).toHaveBeenCalledWith({ holdForRelease: false, earliestDeliveryDate: undefined });
  });

  it('renders field errors', () => {
    render(
      <StepDelivery
        locations={locations}
        values={{ deadlineEnd: '', deliveryLocationId: '' }}
        onChange={vi.fn()}
        errors={{ deadlineEnd: 'Set a response deadline' }}
      />,
    );
    expect(screen.getByText('Set a response deadline')).toBeInTheDocument();
  });
});
