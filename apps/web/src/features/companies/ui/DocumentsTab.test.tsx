import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock SVG icons
vi.mock('@forethread/ui-components/assets/icons/download.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/file-text.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/paperclip.svg?react', () => ({
  default: () => <div />,
}));

// Mock i18n
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number }) =>
      opts?.count !== undefined ? `${key}:${opts.count}` : key,
  }),
}));

// Mock ui-components
vi.mock('@forethread/ui-components', () => ({
  Button: ({ children, leftIcon: _l, ...props }: any) => <button {...props}>{children}</button>,
  Spinner: () => <div data-testid="spinner" />,
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
  EmptyBoxIllustration: () => <div data-testid="empty-box" />,
  ConfirmDialog: ({ onConfirm, onCancel }: any) => (
    <div data-testid="confirm-dialog">
      <button data-testid="confirm-delete" onClick={onConfirm}>
        confirm
      </button>
      <button data-testid="confirm-cancel" onClick={onCancel}>
        cancel
      </button>
    </div>
  ),
  DotActionsMenu: ({
    actions,
  }: {
    actions: { key: string; label: string; onClick: () => void }[];
  }) => (
    <div data-testid="dot-actions">
      {actions.map((a) => (
        <button key={a.key} data-testid={`doc-action-${a.key}`} onClick={a.onClick}>
          {a.label}
        </button>
      ))}
    </div>
  ),
  notificationService: { success: vi.fn(), error: vi.fn() },
}));

// Mock tanstack query
const mockUseQuery = vi.fn();
const mockUploadMutate = vi.fn();
const mockDeleteMutate = vi.fn();
const mockInvalidateQueries = vi.fn();
let mutationCallIndex = 0;
let capturedUploadConfig: any = {};
let capturedDeleteConfig: any = {};
let uploadIsPending = false;
vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (opts: any) => {
    mutationCallIndex++;
    if (mutationCallIndex % 2 === 1) {
      capturedUploadConfig = opts;
      return { mutate: mockUploadMutate, isPending: uploadIsPending, mutationFn: opts?.mutationFn };
    }
    capturedDeleteConfig = opts;
    return { mutate: mockDeleteMutate, isPending: false, mutationFn: opts?.mutationFn };
  },
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

// Mock api-client
vi.mock('@forethread/api-client', () => ({
  getCompanyDocuments: vi.fn(),
  uploadCompanyDocument: vi.fn(),
  deleteCompanyDocument: vi.fn(),
  downloadFile: vi.fn(),
  openFileInNewTab: vi.fn(),
}));

// Mock the review modal (FOR-260) — its own behaviour has a dedicated test.
vi.mock('./DocumentReviewModal', () => ({
  DocumentReviewModal: ({ document, onClose, onApproved }: any) => (
    <div data-testid="review-modal">
      <span data-testid="review-modal-doc">{document.id}</span>
      <button data-testid="review-modal-approve" onClick={onApproved}>
        approve
      </button>
      <button data-testid="review-modal-close" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

import { DocumentsTab } from './DocumentsTab';

const oneDoc = [
  {
    id: 'doc1',
    file: {
      id: 'file1',
      filename: 'contract.pdf',
      size: 15 * 1024 * 1024,
      uploadedBy: { email: 'a@t.com' },
    },
    createdAt: '2026-01-10T00:00:00Z',
  },
];

describe('DocumentsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutationCallIndex = 0;
    uploadIsPending = false;
  });

  it('renders spinner when loading', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    render(<DocumentsTab companyId="c1" />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders empty state when no documents', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders total-file count and download-all/add buttons', () => {
    mockUseQuery.mockReturnValue({ data: oneDoc, isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    expect(screen.getByText('documentsCountLabel:1')).toBeInTheDocument();
    expect(screen.getByText('addDocument')).toBeInTheDocument();
    expect(screen.getByText('downloadAll')).toBeInTheDocument();
  });

  it('renders a file card with filename and size', () => {
    mockUseQuery.mockReturnValue({ data: oneDoc, isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    expect(screen.getByText('contract.pdf')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('15.0 MB')).toBeInTheDocument();
  });

  it('view action calls openFileInNewTab', async () => {
    const apiClient = await import('@forethread/api-client');
    vi.mocked(apiClient.openFileInNewTab).mockResolvedValue(undefined as never);
    mockUseQuery.mockReturnValue({ data: oneDoc, isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    fireEvent.click(screen.getByTestId('doc-action-view'));
    expect(apiClient.openFileInNewTab).toHaveBeenCalledWith('file1');
  });

  it('download action calls downloadFile', async () => {
    const apiClient = await import('@forethread/api-client');
    vi.mocked(apiClient.downloadFile).mockResolvedValue(undefined as never);
    mockUseQuery.mockReturnValue({ data: oneDoc, isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    fireEvent.click(screen.getByTestId('doc-action-download'));
    expect(apiClient.downloadFile).toHaveBeenCalledWith('file1', 'contract.pdf');
  });

  it('download all triggers downloadFile for every doc', async () => {
    const apiClient = await import('@forethread/api-client');
    vi.mocked(apiClient.downloadFile).mockResolvedValue(undefined as never);
    mockUseQuery.mockReturnValue({ data: oneDoc, isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    fireEvent.click(screen.getByText('downloadAll'));
    expect(apiClient.downloadFile).toHaveBeenCalledWith('file1', 'contract.pdf');
  });

  it('delete action opens confirm dialog and confirming triggers delete', () => {
    mockUseQuery.mockReturnValue({ data: oneDoc, isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    fireEvent.click(screen.getByTestId('doc-action-delete'));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-delete'));
    expect(mockDeleteMutate).toHaveBeenCalledWith('doc1');
  });

  it('cancelling delete dialog does not mutate', () => {
    mockUseQuery.mockReturnValue({ data: oneDoc, isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    fireEvent.click(screen.getByTestId('doc-action-delete'));
    fireEvent.click(screen.getByTestId('confirm-cancel'));
    expect(mockDeleteMutate).not.toHaveBeenCalled();
  });

  it('file input change triggers upload', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'test.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(mockUploadMutate).toHaveBeenCalledWith(file);
  });

  it('file input change with no file does not upload', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(mockUploadMutate).not.toHaveBeenCalled();
  });

  it('file input restricts selectable types via accept attribute', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.accept).toBe('.pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp');
  });

  it('rejects a file with an unsupported extension and shows an error', async () => {
    const { notificationService } = await import('@forethread/ui-components');
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'setup.exe', { type: 'application/x-msdownload' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(mockUploadMutate).not.toHaveBeenCalled();
    expect(notificationService.error).toHaveBeenCalledWith('documentInvalidFormat');
  });

  it('rejects a file over 10MB and shows an error', async () => {
    const { notificationService } = await import('@forethread/ui-components');
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024 });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(mockUploadMutate).not.toHaveBeenCalled();
    expect(notificationService.error).toHaveBeenCalledWith('documentTooLarge');
  });

  it('accepts an uppercase extension of a supported type', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'REPORT.PDF', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(mockUploadMutate).toHaveBeenCalledWith(file);
  });

  it('shows uploading text when upload pending', () => {
    uploadIsPending = true;
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    expect(screen.getByText('uploading')).toBeInTheDocument();
  });

  it('upload onSuccess invalidates queries and notifies', async () => {
    const { notificationService } = await import('@forethread/ui-components');
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    void act(() =>
      capturedUploadConfig.onSuccess?.(
        { id: 'new-doc' },
        new File(['x'], 'doc.pdf', { type: 'application/pdf' }),
      ),
    );
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['company-documents', 'c1'] });
    expect(notificationService.success).toHaveBeenCalledWith('documentUploaded');
  });

  it('delete onSuccess invalidates and notifies', async () => {
    const { notificationService } = await import('@forethread/ui-components');
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    capturedDeleteConfig.onSuccess?.();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['company-documents', 'c1'] });
    expect(notificationService.success).toHaveBeenCalledWith('documentDeleted');
  });

  it('upload mutationFn calls uploadCompanyDocument', async () => {
    const apiClient = await import('@forethread/api-client');
    vi.mocked(apiClient.uploadCompanyDocument).mockResolvedValue({} as never);
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    await capturedUploadConfig.mutationFn?.(file);
    expect(apiClient.uploadCompanyDocument).toHaveBeenCalledWith('c1', file);
  });

  it('delete mutationFn calls deleteCompanyDocument', async () => {
    const apiClient = await import('@forethread/api-client');
    vi.mocked(apiClient.deleteCompanyDocument).mockResolvedValue({} as never);
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    await capturedDeleteConfig.mutationFn?.('doc1');
    expect(apiClient.deleteCompanyDocument).toHaveBeenCalledWith('c1', 'doc1');
  });

  // ── FOR-260: review step for extracted document data ───────────────────────

  const docNeedingReview = [
    {
      id: 'doc1',
      file: { id: 'file1', filename: 'cert.pdf', size: 1024 },
      createdAt: '2026-07-30T00:00:00Z',
      extraction: {
        id: 'x1',
        status: 'COMPLETED',
        errorCode: null,
        completedAt: '2026-07-30T10:00:00Z',
        result: { documentType: 'INSURANCE', expiryDate: '2027-01-15' },
      },
    },
  ];

  it('shows a Review pill for a completed unconfirmed extraction and opens the modal', () => {
    mockUseQuery.mockReturnValue({ data: docNeedingReview, isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    fireEvent.click(screen.getByText('reviewExtracted'));
    expect(screen.getByTestId('review-modal')).toBeInTheDocument();
    expect(screen.getByTestId('review-modal-doc')).toHaveTextContent('doc1');
  });

  it('hides the Review pill once the extraction is confirmed', () => {
    const confirmed = [
      {
        ...docNeedingReview[0],
        extraction: { ...docNeedingReview[0].extraction, status: 'CONFIRMED' },
      },
    ];
    mockUseQuery.mockReturnValue({ data: confirmed, isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    expect(screen.queryByText('reviewExtracted')).not.toBeInTheDocument();
    expect(screen.queryByTestId('doc-action-review')).not.toBeInTheDocument();
  });

  it('offers a review card action that opens the modal', () => {
    mockUseQuery.mockReturnValue({ data: docNeedingReview, isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    fireEvent.click(screen.getByTestId('doc-action-review'));
    expect(screen.getByTestId('review-modal')).toBeInTheDocument();
  });

  it('approving from the modal invalidates the list and closes it', () => {
    mockUseQuery.mockReturnValue({ data: docNeedingReview, isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    fireEvent.click(screen.getByText('reviewExtracted'));
    fireEvent.click(screen.getByTestId('review-modal-approve'));
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['company-documents', 'c1'] });
    expect(screen.queryByTestId('review-modal')).not.toBeInTheDocument();
  });

  it('closing the modal saves nothing and just closes', () => {
    mockUseQuery.mockReturnValue({ data: docNeedingReview, isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    fireEvent.click(screen.getByText('reviewExtracted'));
    fireEvent.click(screen.getByTestId('review-modal-close'));
    expect(screen.queryByTestId('review-modal')).not.toBeInTheDocument();
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('auto-opens the review modal when the awaited upload extraction completes', () => {
    mockUseQuery.mockReturnValue({ data: docNeedingReview, isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    expect(screen.queryByTestId('review-modal')).not.toBeInTheDocument();
    // The upload succeeded for doc1; the current data already shows its
    // extraction COMPLETED, so the effect should open the review modal.
    void act(() =>
      capturedUploadConfig.onSuccess?.(
        { id: 'doc1' },
        new File(['x'], 'cert.pdf', { type: 'application/pdf' }),
      ),
    );
    expect(screen.getByTestId('review-modal')).toBeInTheDocument();
  });

  it('does not wait for an extraction after uploading a type with no extraction path', () => {
    mockUseQuery.mockReturnValue({ data: docNeedingReview, isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    void act(() =>
      capturedUploadConfig.onSuccess?.({ id: 'doc1' }, new File(['x'], 'list.docx', { type: '' })),
    );
    expect(screen.queryByTestId('review-modal')).not.toBeInTheDocument();
  });

  it('polls while an extraction is running and stops when none are', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    const { refetchInterval } = mockUseQuery.mock.calls[0][0] as {
      refetchInterval: (query: { state: { data: unknown } }) => number | false;
    };
    const running = [
      { ...docNeedingReview[0], extraction: { id: 'x1', status: 'PROCESSING', result: null } },
    ];
    expect(refetchInterval({ state: { data: running } })).toBe(3000);
    expect(refetchInterval({ state: { data: docNeedingReview } })).toBe(false);
    expect(refetchInterval({ state: { data: [] } })).toBe(false);
  });
});
