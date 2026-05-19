import { render, screen } from '@testing-library/react';

import CreateVendorPage from './CreateVendorPage';

describe('CreateVendorPage', () => {
  it('renders coming soon message', () => {
    render(<CreateVendorPage />);
    expect(screen.getByText(/under development/i)).toBeInTheDocument();
  });
});
