import { render, screen } from '@testing-library/react';

import UploadInvoicePage from './UploadInvoicePage';

describe('UploadInvoicePage', () => {
  it('renders coming soon message', () => {
    render(<UploadInvoicePage />);
    expect(screen.getByText(/under development/i)).toBeInTheDocument();
  });
});
