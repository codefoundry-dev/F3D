import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';

import { SelectVendorsCard, type VendorSelection } from './SelectVendorsCard';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function makeVendor(over: { companyId: string } & Record<string, unknown>) {
  return {
    id: `rv-${over.companyId}`,
    userId: null,
    companyName: 'Vendor',
    companyEmail: null,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    status: 'ACTIVE' as const,
    assignedAt: '',
    specialisations: [],
    categories: [],
    representatives: [],
    ...over,
  };
}

const VENDORS = [
  makeVendor({
    companyId: 'c1',
    companyName: 'Acme',
    representatives: [
      {
        id: 'r1',
        name: 'Jane Rep',
        email: 'jane@acme.com',
        phone: null,
        position: 'Sales',
        status: 'ACTIVE',
        createdAt: '',
      },
      {
        id: 'r2',
        name: 'John Rep',
        email: 'john@acme.com',
        phone: null,
        position: 'Account',
        status: 'ACTIVE',
        createdAt: '',
      },
    ],
  }),
  makeVendor({ companyId: 'c2', companyName: 'NoRep Co', contactEmail: 'sales@norep.com' }),
] as never[];

/** Controlled harness so successive toggles accumulate like the real wizard. */
function Harness({
  initial,
  onChange,
}: {
  initial?: VendorSelection;
  onChange: (n: VendorSelection) => void;
}) {
  const [sel, setSel] = useState<VendorSelection>(initial ?? { vendorIds: [], repIds: [] });
  return (
    <SelectVendorsCard
      vendors={VENDORS}
      selectedVendorIds={sel.vendorIds}
      selectedRepIds={sel.repIds}
      onChange={(next) => {
        setSel(next);
        onChange(next);
      }}
    />
  );
}

describe('SelectVendorsCard', () => {
  it('selecting a rep adds the rep and its vendor company', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(screen.getByTestId('vendor-expand-c1'));
    fireEvent.click(within(screen.getByTestId('rep-row-r1')).getByRole('checkbox'));

    expect(onChange).toHaveBeenLastCalledWith({ vendorIds: ['c1'], repIds: ['r1'] });
  });

  it('"Add all reps" selects every rep of the vendor', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(screen.getByTestId('vendor-toggle-c1'));

    expect(onChange).toHaveBeenLastCalledWith({ vendorIds: ['c1'], repIds: ['r1', 'r2'] });
  });

  it('a vendor with no reps is added at the company level (no reps)', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(screen.getByTestId('vendor-toggle-c2'));

    expect(onChange).toHaveBeenLastCalledWith({ vendorIds: ['c2'], repIds: [] });
  });

  it('removing the last selected rep removes the vendor from the RFQ', () => {
    const onChange = vi.fn();
    render(<Harness initial={{ vendorIds: ['c1'], repIds: ['r1'] }} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('rep-remove-r1'));

    expect(onChange).toHaveBeenLastCalledWith({ vendorIds: [], repIds: [] });
  });
});
