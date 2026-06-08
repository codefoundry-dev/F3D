import { render, screen, within } from '@testing-library/react';

import { StepReview } from './StepReview';

// id = assignment row id, companyId = vendor Company id. Selection is keyed on
// companyId (what the RFQ backend validates), so the two differ here.
const vendors = [
  { id: 'assign-1', companyId: 'company-1', companyName: 'Acme Supplies' },
  { id: 'assign-2', companyId: 'company-2', companyName: 'BuildCo' },
] as any;
const locations = [{ id: 'l1', type: 'DELIVERY', address: '1 Build St', label: 'Site' }] as any;

const lineItems = [
  { materialId: 'm1', materialName: 'Cement', quantity: 50, uom: 'bag', costCode: 'CC-1' },
];

const delivery = {
  deadlineEnd: '2030-01-15T00:00:00.000Z',
  deliveryLocationId: 'l1',
  holdForRelease: false,
  currency: 'AUD',
};

describe('StepReview', () => {
  it('renders the project, materials, vendors and delivery summary', () => {
    render(
      <StepReview
        projectName="Tower 5"
        lineItems={lineItems}
        vendors={vendors}
        selectedVendorIds={['company-1']}
        delivery={delivery}
        locations={locations}
      />,
    );

    expect(screen.getByText('Tower 5')).toBeInTheDocument();

    const items = screen.getByTestId('review-line-items');
    expect(within(items).getByText('Cement')).toBeInTheDocument();
    expect(within(items).getByText(/50 bag/)).toBeInTheDocument();

    const reviewVendors = screen.getByTestId('review-vendors');
    expect(within(reviewVendors).getByText('Acme Supplies')).toBeInTheDocument();
    expect(within(reviewVendors).queryByText('BuildCo')).not.toBeInTheDocument();

    expect(screen.getByText('Site — 1 Build St')).toBeInTheDocument();
    expect(screen.getByText('AUD')).toBeInTheDocument();
  });

  it('shows empty states when slices are blank', () => {
    render(
      <StepReview
        projectName=""
        lineItems={[]}
        vendors={vendors}
        selectedVendorIds={[]}
        delivery={{ deadlineEnd: '', deliveryLocationId: '' }}
        locations={locations}
      />,
    );
    expect(screen.getByText('No materials added.')).toBeInTheDocument();
    expect(screen.getByText('No vendors selected.')).toBeInTheDocument();
  });

  it('shows the earliest delivery date row only when hold-for-release is on', () => {
    render(
      <StepReview
        projectName="Tower 5"
        lineItems={lineItems}
        vendors={vendors}
        selectedVendorIds={['company-1']}
        delivery={{ ...delivery, holdForRelease: true, earliestDeliveryDate: '2030-02-01T00:00:00.000Z' }}
        locations={locations}
      />,
    );
    expect(screen.getByText('Earliest delivery date')).toBeInTheDocument();
  });
});
