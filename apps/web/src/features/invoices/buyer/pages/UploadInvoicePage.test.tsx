import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockUpload = { mutateAsync: vi.fn(), isPending: false };
let mockIntakeEmail: string | null = 'invoices-abc123@in.test.com';

vi.mock('@forethread/invoice-shared', () => ({
  useUploadInvoice: () => mockUpload,
  useInvoiceIntakeAddress: () => ({ data: { email: mockIntakeEmail } }),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: (s: { setTitle: () => void }) => unknown) =>
    selector({ setTitle: vi.fn() }),
}));

import UploadInvoicePage from './UploadInvoicePage';

function renderPage() {
  return render(
    <MemoryRouter>
      <UploadInvoicePage />
    </MemoryRouter>,
  );
}

describe('UploadInvoicePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIntakeEmail = 'invoices-abc123@in.test.com';
  });

  it('renders the dropzone and upload controls', () => {
    renderPage();
    expect(screen.getByTestId('upload-invoice-page')).toBeInTheDocument();
    expect(screen.getByTestId('upload-invoice-dropzone')).toBeInTheDocument();
    expect(screen.getByTestId('upload-invoice-submit')).toBeDisabled();
  });

  it('shows the company intake email address with a copy button', () => {
    renderPage();
    expect(screen.getByTestId('upload-invoice-inbox-address')).toHaveTextContent(
      'invoices-abc123@in.test.com',
    );
    expect(screen.getByTestId('upload-invoice-inbox-copy')).toBeInTheDocument();
  });

  it('hides the inbox panel when inbound email is not configured', () => {
    mockIntakeEmail = null;
    renderPage();
    expect(screen.queryByTestId('upload-invoice-inbox')).not.toBeInTheDocument();
  });
});
