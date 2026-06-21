import { render, screen, fireEvent } from '@testing-library/react';

// Stub the shared UI primitives the component depends on.
vi.mock('@forethread/ui-components', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  buttonVariants: () => 'btn',
  DatePicker: ({ value, onChange, placeholder }: any) => (
    <input
      data-testid={`date-picker-${placeholder}`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));
vi.mock('@forethread/ui-components/assets/icons/chevron-down.svg?react', () => ({
  default: (p: any) => <svg data-testid="icon-chevron-down" {...p} />,
}));

import { DateRangeFilterPopover } from './DateRangeFilterPopover';

function setup(overrides: Partial<React.ComponentProps<typeof DateRangeFilterPopover>> = {}) {
  const onChangeFrom = vi.fn();
  const onChangeTo = vi.fn();
  const onClear = vi.fn();
  render(
    <DateRangeFilterPopover
      label="Date"
      popoverTitle="Date"
      dateFrom=""
      dateTo=""
      onChangeFrom={onChangeFrom}
      onChangeTo={onChangeTo}
      onClear={onClear}
      fromPlaceholder="From"
      toPlaceholder="To"
      {...overrides}
    />,
  );
  return { onChangeFrom, onChangeTo, onClear };
}

describe('DateRangeFilterPopover', () => {
  it('renders the trigger pill with the label and is closed by default', () => {
    setup();
    expect(screen.getByText('Date')).toBeInTheDocument();
    // Popover content (the date inputs) is not mounted until opened.
    expect(screen.queryByTestId('date-picker-From')).not.toBeInTheDocument();
  });

  it('opens the popover when the trigger is clicked, revealing From/To pickers', () => {
    setup();
    fireEvent.click(screen.getByText('Date'));
    expect(screen.getByTestId('date-picker-From')).toBeInTheDocument();
    expect(screen.getByTestId('date-picker-To')).toBeInTheDocument();
  });

  it('forwards date changes to onChangeFrom / onChangeTo', () => {
    const { onChangeFrom, onChangeTo } = setup();
    fireEvent.click(screen.getByText('Date'));
    fireEvent.change(screen.getByTestId('date-picker-From'), { target: { value: '2025-01-01' } });
    expect(onChangeFrom).toHaveBeenCalledWith('2025-01-01');
    fireEvent.change(screen.getByTestId('date-picker-To'), { target: { value: '2025-02-01' } });
    expect(onChangeTo).toHaveBeenCalledWith('2025-02-01');
  });

  it('shows the active count badge and Clear button when a date is set', () => {
    const { onClear } = setup({ dateFrom: '2025-01-01' });
    // Active badge shows "1" on the trigger.
    expect(screen.getByText('1')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Date'));
    const clearBtn = screen.getByText('Clear');
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalled();
  });

  it('does not show the Clear button when no date is set', () => {
    setup();
    fireEvent.click(screen.getByText('Date'));
    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
  });
});
