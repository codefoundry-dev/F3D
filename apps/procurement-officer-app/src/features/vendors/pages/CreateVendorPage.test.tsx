import { render, screen } from '@testing-library/react';

import CreateVendorPage from './CreateVendorPage';

describe('CreateVendorPage', () => {
  it('renders under development text', () => {
    render(<CreateVendorPage />);
    expect(screen.getByText(/vendor creation will be available soon/i)).toBeInTheDocument();
  });
});
