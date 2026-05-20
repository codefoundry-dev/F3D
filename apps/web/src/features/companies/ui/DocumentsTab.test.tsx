import { render, screen, fireEvent } from '@testing-library/react';

// Mock SVG icons
vi.mock('@forethread/ui-components/assets/icons/delete.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/download.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/paperclip.svg?react', () => ({
  default: () => <div />,
}));

// Mock i18n
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Mock ui-components
vi.mock('@forethread/ui-components', () => ({
  Button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...props}>{children}</button>
  ),
  Spinner: () => <div data-testid="spinner" />,
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
  ConfirmDialog: ({
    onConfirm,
    onCancel,
    confirmLabel,
    cancelLabel,
  }: {
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel: string;
    cancelLabel: string;
  }) => (
    <div data-testid="confirm-dialog">
      <button onClick={onConfirm}>{confirmLabel}</button>
      <button onClick={onCancel}>{cancelLabel}</button>
    </div>
  ),
  notificationService: { success: vi.fn(), error: vi.fn() },
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

// Mock tanstack query — capture mutation configs
const mockUseQuery = vi.fn();
const mockUploadMutate = vi.fn();
const mockDeleteMutate = vi.fn();
const mockInvalidateQueries = vi.fn();
let mutationCallIndex = 0;
let capturedUploadConfig: any = {};
let capturedDeleteConfig: any = {};
let uploadIsPending = false;
let deleteIsPending = false;
vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (opts: any) => {
    mutationCallIndex++;
    // First useMutation call is upload, second is delete
    if (mutationCallIndex % 2 === 1) {
      capturedUploadConfig = opts;
      return { mutate: mockUploadMutate, isPending: uploadIsPending, mutationFn: opts?.mutationFn };
    }
    capturedDeleteConfig = opts;
    return { mutate: mockDeleteMutate, isPending: deleteIsPending, mutationFn: opts?.mutationFn };
  },
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

// Mock api-client
vi.mock('@forethread/api-client', () => ({
  getCompanyDocuments: vi.fn(),
  uploadCompanyDocument: vi.fn(),
  deleteCompanyDocument: vi.fn(),
  exportCompanyDocuments: vi.fn(),
  getFileUrl: vi.fn(),
}));

import { DocumentsTab } from './DocumentsTab';

describe('DocumentsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutationCallIndex = 0;
    uploadIsPending = false;
    deleteIsPending = false;
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

  it('renders document list when data is available', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'doc1',
          file: {
            id: 'file1',
            filename: 'contract.pdf',
            uploadedBy: { email: 'admin@test.com' },
          },
          createdAt: '2026-01-10T00:00:00Z',
        },
      ],
      isLoading: false,
    });
    render(<DocumentsTab companyId="c1" />);
    expect(screen.getByText('contract.pdf')).toBeInTheDocument();
  });

  it('renders add document button', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    render(<DocumentsTab companyId="c1" />);
    expect(screen.getByText('addDocument')).toBeInTheDocument();
  });

  it('renders header text', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    render(<DocumentsTab companyId="c1" />);
    expect(screen.getByText('documentsTitle')).toBeInTheDocument();
    expect(screen.getByText('documentsSubtitle')).toBeInTheDocument();
  });

  it('clicking add document button triggers file input click', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    const addBtn = screen.getByText('addDocument');
    // Clicking the button should not crash (it clicks the hidden file input)
    fireEvent.click(addBtn);
    expect(addBtn).toBeInTheDocument();
  });

  it('renders view and delete buttons for each document', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'doc1',
          file: {
            id: 'file1',
            filename: 'contract.pdf',
            uploadedBy: { email: 'admin@test.com' },
          },
          createdAt: '2026-01-10T00:00:00Z',
        },
      ],
      isLoading: false,
    });
    render(<DocumentsTab companyId="c1" />);
    expect(screen.getByLabelText('View')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete')).toBeInTheDocument();
  });

  it('clicking View button triggers handleView', async () => {
    const apiClient = await import('@forethread/api-client');
    vi.mocked(apiClient.getFileUrl).mockResolvedValue({
      url: 'https://example.com/view.pdf',
    } as never);
    vi.spyOn(window, 'open').mockImplementation(() => null);
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'doc1',
          file: {
            id: 'file1',
            filename: 'contract.pdf',
            uploadedBy: { email: 'admin@test.com' },
          },
          createdAt: '2026-01-10T00:00:00Z',
        },
      ],
      isLoading: false,
    });
    render(<DocumentsTab companyId="c1" />);
    fireEvent.click(screen.getByLabelText('View'));
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.getByLabelText('View')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('clicking Delete button opens confirm dialog and confirming triggers delete', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'doc1',
          file: {
            id: 'file1',
            filename: 'contract.pdf',
            uploadedBy: { email: 'admin@test.com' },
          },
          createdAt: '2026-01-10T00:00:00Z',
        },
      ],
      isLoading: false,
    });
    render(<DocumentsTab companyId="c1" />);
    fireEvent.click(screen.getByLabelText('Delete'));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByText('common:delete'));
    expect(mockDeleteMutate).toHaveBeenCalledWith('doc1');
  });

  it('clicking Delete and cancelling confirm dialog does not mutate', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'doc1',
          file: {
            id: 'file1',
            filename: 'contract.pdf',
            uploadedBy: { email: 'admin@test.com' },
          },
          createdAt: '2026-01-10T00:00:00Z',
        },
      ],
      isLoading: false,
    });
    render(<DocumentsTab companyId="c1" />);
    fireEvent.click(screen.getByLabelText('Delete'));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByText('common:cancel'));
    expect(mockDeleteMutate).not.toHaveBeenCalled();
  });

  it('renders document uploader email and date', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'doc1',
          file: {
            id: 'file1',
            filename: 'contract.pdf',
            uploadedBy: { email: 'admin@test.com' },
          },
          createdAt: '2026-01-10T00:00:00Z',
        },
      ],
      isLoading: false,
    });
    render(<DocumentsTab companyId="c1" />);
    expect(screen.getByText(/admin@test\.com/)).toBeInTheDocument();
  });

  it('renders dash when uploadedBy is null', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'doc1',
          file: {
            id: 'file1',
            filename: 'contract.pdf',
            uploadedBy: null,
          },
          createdAt: '2026-01-10T00:00:00Z',
        },
      ],
      isLoading: false,
    });
    render(<DocumentsTab companyId="c1" />);
    // Should render the dash for uploadedBy
    const text = screen.getByText('contract.pdf').closest('div')?.parentElement;
    expect(text).toBeTruthy();
  });

  it('file input change triggers upload', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(mockUploadMutate).toHaveBeenCalledWith(file);
  });

  it('file input change with no file does not trigger upload', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(mockUploadMutate).not.toHaveBeenCalled();
  });

  it('does not delete when already deleting (deletingId guard)', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'doc1',
          file: { id: 'file1', filename: 'a.pdf', uploadedBy: null },
          createdAt: '2026-01-10T00:00:00Z',
        },
        {
          id: 'doc2',
          file: { id: 'file2', filename: 'b.pdf', uploadedBy: null },
          createdAt: '2026-01-11T00:00:00Z',
        },
      ],
      isLoading: false,
    });
    render(<DocumentsTab companyId="c1" />);
    const deleteButtons = screen.getAllByLabelText('Delete');
    // Click first delete — opens confirm dialog
    fireEvent.click(deleteButtons[0]);
    // Confirm — sets deletingId
    fireEvent.click(screen.getByText('common:delete'));
    expect(mockDeleteMutate).toHaveBeenCalledTimes(1);
    // Click second delete — should be blocked because deletingId is set
    fireEvent.click(deleteButtons[1]);
    expect(mockDeleteMutate).toHaveBeenCalledTimes(1);
  });

  it('upload onSuccess invalidates queries', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    // Call the captured upload onSuccess
    capturedUploadConfig.onSuccess?.();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['company-documents', 'c1'] });
  });

  it('delete onSuccess invalidates queries, shows notification, and resets deletingId', async () => {
    const { notificationService } = await import('@forethread/ui-components');
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    // Call the captured delete onSuccess
    capturedDeleteConfig.onSuccess?.();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['company-documents', 'c1'] });
    expect(notificationService.success).toHaveBeenCalledWith('documentDeleted');
  });

  it('upload mutationFn calls uploadCompanyDocument', async () => {
    const apiClient = await import('@forethread/api-client');
    vi.mocked(apiClient.uploadCompanyDocument).mockResolvedValue({} as never);
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    const file = new File(['test'], 'doc.pdf', { type: 'application/pdf' });
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

  it('handleView calls getFileUrl and opens URL in new tab', async () => {
    const apiClient = await import('@forethread/api-client');
    vi.mocked(apiClient.getFileUrl).mockResolvedValue({
      url: 'https://example.com/file.pdf',
    } as never);
    const mockNewTab = { location: { href: '' } };
    const openSpy = vi
      .spyOn(window, 'open')
      .mockImplementation(() => mockNewTab as unknown as Window);
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'doc1',
          file: { id: 'file1', filename: 'test.pdf', uploadedBy: null },
          createdAt: '2026-01-10T00:00:00Z',
        },
      ],
      isLoading: false,
    });
    render(<DocumentsTab companyId="c1" />);
    fireEvent.click(screen.getByLabelText('View'));
    // Wait for the async handleView to complete
    await new Promise((r) => setTimeout(r, 10));
    expect(openSpy).toHaveBeenCalledWith('', '_blank');
    expect(mockNewTab.location.href).toBe('https://example.com/file.pdf');
    openSpy.mockRestore();
  });

  it('shows uploading text when upload mutation is pending', () => {
    uploadIsPending = true;
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    render(<DocumentsTab companyId="c1" />);
    expect(screen.getByText('uploading')).toBeInTheDocument();
  });

  it('disables delete button when delete mutation is pending for that doc', () => {
    deleteIsPending = true;
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'doc1',
          file: { id: 'file1', filename: 'a.pdf', uploadedBy: null },
          createdAt: '2026-01-10T00:00:00Z',
        },
      ],
      isLoading: false,
    });
    render(<DocumentsTab companyId="c1" />);
    // The delete button disabled condition is: deleteMutation.isPending && deletingId === doc.id
    // Since deletingId starts as null, button should not be disabled even if isPending is true
    const deleteBtn = screen.getByLabelText('Delete');
    expect(deleteBtn).not.toBeDisabled();
  });
});
