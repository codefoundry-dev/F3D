import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@forethread/ui-components/assets/icons/file-text.svg?react', () => ({
  default: () => <div />,
}));

// Mock i18n
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock ui-components
vi.mock('@forethread/ui-components', () => ({
  GridModal: ({ children, actions, onSubmit, title, description }: any) => (
    <div data-testid="grid-modal">
      <div data-testid="modal-title">{title}</div>
      <div data-testid="modal-description">{description}</div>
      <form data-testid="modal-form" onSubmit={onSubmit}>
        {children}
        {actions}
      </form>
    </div>
  ),
  Button: ({ children, isLoading: _l, ...props }: any) => <button {...props}>{children}</button>,
  FormField: ({ label, children }: any) => (
    <div>
      <span>{label}</span>
      {children}
    </div>
  ),
  CustomDropdown: ({ options, value, onChange }: any) => (
    <div data-testid="type-dropdown" data-value={value}>
      {options.map((o: any) => (
        <button
          key={o.value}
          type="button"
          data-testid={`type-option-${o.value}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  ),
  DatePicker: ({ value, onChange }: any) => (
    <input data-testid="expiry-input" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
  notificationService: { success: vi.fn(), error: vi.fn() },
}));

// Mock tanstack query — mutate runs the mutationFn and fires onSuccess.
vi.mock('@tanstack/react-query', () => ({
  useMutation: (opts: any) => ({
    mutate: () => {
      void opts.mutationFn().then((result: unknown) => opts.onSuccess?.(result));
    },
    isPending: false,
  }),
}));

// Mock api-client
vi.mock('@forethread/api-client', () => ({
  reviewCompanyDocument: vi.fn(),
}));

import { DocumentReviewModal } from './DocumentReviewModal';

const baseDoc = {
  id: 'doc1',
  companyId: 'c1',
  type: 'OTHER',
  fileId: 'file1',
  expiresAt: null,
  createdAt: '2026-07-30T00:00:00Z',
  file: { id: 'file1', filename: 'cert.pdf', mimeType: 'application/pdf', size: 1024 },
  extraction: {
    id: 'x1',
    status: 'COMPLETED' as const,
    errorCode: null,
    completedAt: '2026-07-30T10:00:00Z',
    result: {
      documentType: 'INSURANCE' as const,
      title: 'Certificate of Liability Insurance',
      issuer: 'Acme Mutual',
      documentNumber: null,
      holderName: null,
      issuedDate: null,
      expiryDate: '2027-01-15',
      summary: null,
    },
  },
};

const onClose = vi.fn();
const onApproved = vi.fn();

function renderModal(doc: any = baseDoc) {
  return render(
    <DocumentReviewModal
      companyId="c1"
      document={doc as never}
      onClose={onClose}
      onApproved={onApproved}
    />,
  );
}

describe('DocumentReviewModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays only the extracted fields that have values', () => {
    renderModal();
    expect(screen.getByText('Certificate of Liability Insurance')).toBeInTheDocument();
    expect(screen.getByText('Acme Mutual')).toBeInTheDocument();
    expect(screen.queryByText('reviewModal.fields.documentNumber')).not.toBeInTheDocument();
    expect(screen.queryByText('reviewModal.fields.holderName')).not.toBeInTheDocument();
  });

  it('seeds the form from the extracted values', () => {
    renderModal();
    expect(screen.getByTestId('type-dropdown')).toHaveAttribute('data-value', 'INSURANCE');
    expect(screen.getByTestId('expiry-input')).toHaveValue('2027-01-15');
  });

  it('falls back to the stored document values without an extraction result', () => {
    renderModal({
      ...baseDoc,
      type: 'LICENSE',
      expiresAt: '2026-05-01T00:00:00.000Z',
      extraction: { ...baseDoc.extraction, result: null as never },
    });
    expect(screen.getByTestId('type-dropdown')).toHaveAttribute('data-value', 'LICENSE');
    expect(screen.getByTestId('expiry-input')).toHaveValue('2026-05-01');
    expect(screen.queryByText('reviewModal.extractedData')).not.toBeInTheDocument();
  });

  it('leaves the expiry empty and shows a hint for an unparseable extracted date', () => {
    renderModal({
      ...baseDoc,
      extraction: {
        ...baseDoc.extraction,
        result: { ...baseDoc.extraction.result, expiryDate: 'June next year' },
      },
    });
    expect(screen.getByTestId('expiry-input')).toHaveValue('');
    expect(screen.getByText('reviewModal.extractedHint')).toBeInTheDocument();
  });

  it('approving saves the (possibly corrected) values', async () => {
    const apiClient = await import('@forethread/api-client');
    vi.mocked(apiClient.reviewCompanyDocument).mockResolvedValue({} as never);
    const { notificationService } = await import('@forethread/ui-components');
    renderModal();

    // Correct the extracted classification before approving.
    fireEvent.click(screen.getByTestId('type-option-CERTIFICATION'));
    fireEvent.submit(screen.getByTestId('modal-form'));

    await waitFor(() => {
      expect(apiClient.reviewCompanyDocument).toHaveBeenCalledWith('c1', 'doc1', {
        type: 'CERTIFICATION',
        expiresAt: '2027-01-15',
      });
    });
    await waitFor(() => expect(onApproved).toHaveBeenCalled());
    expect(notificationService.success).toHaveBeenCalledWith('reviewModal.approved');
  });

  it('omits the expiry when the reviewer cleared it', async () => {
    const apiClient = await import('@forethread/api-client');
    vi.mocked(apiClient.reviewCompanyDocument).mockResolvedValue({} as never);
    renderModal();

    fireEvent.change(screen.getByTestId('expiry-input'), { target: { value: '' } });
    fireEvent.submit(screen.getByTestId('modal-form'));

    await waitFor(() => {
      expect(apiClient.reviewCompanyDocument).toHaveBeenCalledWith('c1', 'doc1', {
        type: 'INSURANCE',
        expiresAt: undefined,
      });
    });
  });

  it('cancelling closes without saving anything', async () => {
    const apiClient = await import('@forethread/api-client');
    renderModal();

    fireEvent.click(screen.getByText('common:cancel'));

    expect(onClose).toHaveBeenCalled();
    expect(apiClient.reviewCompanyDocument).not.toHaveBeenCalled();
    expect(onApproved).not.toHaveBeenCalled();
  });
});
