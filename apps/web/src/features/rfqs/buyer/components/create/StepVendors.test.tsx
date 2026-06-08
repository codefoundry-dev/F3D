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
}));

import { StepVendors } from './StepVendors';

// id = assignment row id, companyId = vendor Company id. The wizard must
// select by companyId (what the RFQ backend validates), so these differ here
// to guard against regressing back to vendor.id.
const vendors = [
  { id: 'assign-1', companyId: 'company-1', companyName: 'Acme Supplies' },
  { id: 'assign-2', companyId: 'company-2', companyName: 'BuildCo' },
] as any;

describe('StepVendors', () => {
  it('renders the heading and the vendor list', () => {
    render(<StepVendors vendors={vendors} selectedIds={[]} onToggle={vi.fn()} />);
    expect(screen.getByText('Vendors')).toBeInTheDocument();
    expect(screen.getByText('Acme Supplies')).toBeInTheDocument();
    expect(screen.getByText('BuildCo')).toBeInTheDocument();
  });

  it('shows a loading state', () => {
    render(<StepVendors vendors={[]} selectedIds={[]} onToggle={vi.fn()} isLoading />);
    expect(screen.getByText(/Loading vendors/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no vendors', () => {
    render(<StepVendors vendors={[]} selectedIds={[]} onToggle={vi.fn()} />);
    expect(screen.getByText(/No assigned vendors found/i)).toBeInTheDocument();
  });

  it('toggles a vendor on by companyId', () => {
    const onToggle = vi.fn();
    render(<StepVendors vendors={vendors} selectedIds={[]} onToggle={onToggle} />);
    fireEvent.click(screen.getByLabelText('Acme Supplies'));
    expect(onToggle).toHaveBeenCalledWith('company-1', true);
  });

  it('toggles a selected vendor off by companyId', () => {
    const onToggle = vi.fn();
    render(<StepVendors vendors={vendors} selectedIds={['company-1']} onToggle={onToggle} />);
    fireEvent.click(screen.getByLabelText('Acme Supplies'));
    expect(onToggle).toHaveBeenCalledWith('company-1', false);
  });

  it('renders the validation error', () => {
    render(
      <StepVendors
        vendors={vendors}
        selectedIds={[]}
        onToggle={vi.fn()}
        error="Invite at least one vendor"
      />,
    );
    expect(screen.getByText('Invite at least one vendor')).toBeInTheDocument();
  });
});
