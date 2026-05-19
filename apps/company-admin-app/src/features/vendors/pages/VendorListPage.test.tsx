vi.mock('@forethread/vendor-shared', () => ({
  VendorListPage: () => <div data-testid="shared-vendor-list" />,
}));

import { render, screen } from '@testing-library/react';

import VendorListPage from './VendorListPage';

describe('VendorListPage', () => {
  it('renders the shared vendor list page', () => {
    render(<VendorListPage />);
    expect(screen.getByTestId('shared-vendor-list')).toBeInTheDocument();
  });
});
