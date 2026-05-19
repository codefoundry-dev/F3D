import { render, screen } from '@testing-library/react';

import UploadInvoicePage from './UploadInvoicePage';

describe('UploadInvoicePage', () => {
  it('renders under development text', () => {
    render(<UploadInvoicePage />);
    expect(screen.getByText(/invoice upload will be available soon/i)).toBeInTheDocument();
  });
});
