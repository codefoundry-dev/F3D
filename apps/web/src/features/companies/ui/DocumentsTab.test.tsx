import { render, screen, fireEvent } from '@testing-library/react';

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

  it('shows uploading text when upload pending', () => {
    uploadIsPending = true;
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    expect(screen.getByText('uploading')).toBeInTheDocument();
  });

  it('upload onSuccess invalidates queries', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    capturedUploadConfig.onSuccess?.();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['company-documents', 'c1'] });
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
});
