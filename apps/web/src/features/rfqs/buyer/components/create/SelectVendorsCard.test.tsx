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

/** Controlled harness so successive toggles accumulate like the real wizard.
 *  Search/category are now server-side, so the harness owns them as plain state
 *  and simply hands the (already filtered) rows straight through. */
function Harness({
  initial,
  onChange,
  vendors = VENDORS,
  onAddAll = vi.fn(),
}: {
  initial?: VendorSelection;
  onChange: (n: VendorSelection) => void;
  vendors?: never[];
  onAddAll?: () => void;
}) {
  const [sel, setSel] = useState<VendorSelection>(initial ?? { vendorIds: [], repIds: [] });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  return (
    <SelectVendorsCard
      vendors={vendors}
      selectedVendorIds={sel.vendorIds}
      selectedRepIds={sel.repIds}
      onChange={(next) => {
        setSel(next);
        onChange(next);
      }}
      search={search}
      onSearchChange={setSearch}
      categoryFilter={category}
      onCategoryFilterChange={setCategory}
      onAddAll={onAddAll}
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

  // ── Deactivated reps are unsendable (CONTEXT.md / ADR-0018) ─────────────────

  const WITH_DEACTIVATED = [
    makeVendor({
      companyId: 'c3',
      companyName: 'Half Dead Co',
      representatives: [
        {
          id: 'live',
          name: 'Live Rep',
          email: 'live@hd.com',
          phone: null,
          position: null,
          status: 'ACTIVE',
          createdAt: '',
        },
        {
          id: 'gone',
          name: 'Gone Rep',
          email: 'gone@hd.com',
          phone: null,
          position: null,
          status: 'INACTIVE',
          createdAt: '',
        },
      ],
    }),
  ] as never[];

  it('"add all reps" never selects a deactivated rep', () => {
    const onChange = vi.fn();
    render(<Harness vendors={WITH_DEACTIVATED} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('vendor-toggle-c3'));

    expect(onChange).toHaveBeenLastCalledWith({ vendorIds: ['c3'], repIds: ['live'] });
  });

  it('renders a deactivated rep but disables its checkbox', () => {
    render(<Harness vendors={WITH_DEACTIVATED} onChange={vi.fn()} />);

    fireEvent.click(screen.getByTestId('vendor-expand-c3'));

    expect(within(screen.getByTestId('rep-row-gone')).getByRole('checkbox')).toBeDisabled();
    expect(within(screen.getByTestId('rep-row-live')).getByRole('checkbox')).not.toBeDisabled();
  });

  it('delegates "Add all" to the server-side resolver rather than the loaded rows', () => {
    const onAddAll = vi.fn();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} onAddAll={onAddAll} />);

    fireEvent.click(screen.getByTestId('vendor-add-all'));

    expect(onAddAll).toHaveBeenCalledTimes(1);
    // The card must not resolve the selection itself — a page-local loop is
    // exactly the silent truncation this replaces.
    expect(onChange).not.toHaveBeenCalled();
  });
});
