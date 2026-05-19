import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

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

vi.mock('@forethread/ui-components', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button data-testid="button" onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
  Spinner: ({ size }: any) => <div data-testid="spinner" data-size={size} />,
  EmptyState: ({ title }: any) => (
    <div data-testid="empty-state">
      <span>{title}</span>
    </div>
  ),
  ConfirmDialog: ({ title, onConfirm, onCancel }: any) => (
    <div data-testid="confirm-dialog">
      <span>{title}</span>
      <button data-testid="confirm-delete" onClick={onConfirm}>
        Confirm
      </button>
      <button data-testid="cancel-delete" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
  notificationService: { success: vi.fn(), error: vi.fn() },
}));

const mockGetCompanyDocuments = vi.hoisted(() => vi.fn());
const mockUploadCompanyDocument = vi.hoisted(() => vi.fn());
const mockDeleteCompanyDocument = vi.hoisted(() => vi.fn());
const mockExportCompanyDocuments = vi.hoisted(() => vi.fn());
const mockGetFileUrl = vi.hoisted(() => vi.fn());
vi.mock('@forethread/api-client', () => ({
  getCompanyDocuments: (...args: unknown[]) => mockGetCompanyDocuments(...args),
  uploadCompanyDocument: (...args: unknown[]) => mockUploadCompanyDocument(...args),
  deleteCompanyDocument: (...args: unknown[]) => mockDeleteCompanyDocument(...args),
  exportCompanyDocuments: (...args: unknown[]) => mockExportCompanyDocuments(...args),
  getFileUrl: (...args: unknown[]) => mockGetFileUrl(...args),
}));

const mockQueryResult = vi.hoisted(() => ({
  data: undefined as any,
  isLoading: false,
}));

const mockMutate = vi.hoisted(() => vi.fn());
const mockUploadMutationState = vi.hoisted(() => ({ isPending: false }));
const capturedOnSuccessCallbacks = vi.hoisted(() => [] as Array<(() => void) | undefined>);

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => mockQueryResult,
  useMutation: (opts: { mutationFn: unknown; onSuccess?: () => void }) => {
    capturedOnSuccessCallbacks.push(opts.onSuccess);
    return {
      mutate: (...args: unknown[]) => mockMutate(...args),
      isPending: mockUploadMutationState.isPending,
    };
  },
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

import { DocumentsTab } from './DocumentsTab';

const mockDocuments = [
  {
    id: 'doc1',
    createdAt: '2026-02-15',
    file: {
      id: 'f1',
      filename: 'insurance.pdf',
      uploadedBy: { email: 'admin@acme.com' },
    },
  },
  {
    id: 'doc2',
    createdAt: '2026-03-01',
    file: {
      id: 'f2',
      filename: 'license.pdf',
      uploadedBy: null,
    },
  },
];

describe('DocumentsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryResult.data = undefined;
    mockQueryResult.isLoading = false;
    mockUploadMutationState.isPending = false;
  });

  it('renders header with title and subtitle', () => {
    render(<DocumentsTab companyId="c1" />);
    expect(screen.getByText('documentsTitle')).toBeInTheDocument();
    expect(screen.getByText('documentsSubtitle')).toBeInTheDocument();
  });

  it('shows spinner when loading', () => {
    mockQueryResult.isLoading = true;
    render(<DocumentsTab companyId="c1" />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows empty state when no documents', () => {
    mockQueryResult.data = [];
    render(<DocumentsTab companyId="c1" />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('noDocuments')).toBeInTheDocument();
  });

  it('shows empty state when documents is undefined', () => {
    mockQueryResult.data = undefined;
    render(<DocumentsTab companyId="c1" />);
    // undefined?.length is undefined -> falsy -> empty state
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders document list when documents exist', () => {
    mockQueryResult.data = mockDocuments;
    render(<DocumentsTab companyId="c1" />);
    expect(screen.getByText('insurance.pdf')).toBeInTheDocument();
    expect(screen.getByText('license.pdf')).toBeInTheDocument();
  });

  it('renders uploader email for documents with uploadedBy', () => {
    mockQueryResult.data = mockDocuments;
    render(<DocumentsTab companyId="c1" />);
    expect(screen.getByText(/admin@acme.com/)).toBeInTheDocument();
  });

  it('renders dash for documents without uploadedBy', () => {
    mockQueryResult.data = mockDocuments;
    render(<DocumentsTab companyId="c1" />);
    // doc2 has null uploadedBy, should show "—"
    expect(screen.getByText(/—/)).toBeInTheDocument();
  });

  it('renders view and delete buttons for each document', () => {
    mockQueryResult.data = mockDocuments;
    render(<DocumentsTab companyId="c1" />);
    expect(screen.getAllByLabelText('View')).toHaveLength(2);
    expect(screen.getAllByLabelText('Delete')).toHaveLength(2);
  });

  it('renders add document button', () => {
    render(<DocumentsTab companyId="c1" />);
    expect(screen.getByText('addDocument')).toBeInTheDocument();
  });

  it('shows uploading text when upload is pending', () => {
    mockUploadMutationState.isPending = true;
    render(<DocumentsTab companyId="c1" />);
    expect(screen.getByText('uploading')).toBeInTheDocument();
  });

  it('opens confirm dialog when delete is clicked', () => {
    mockQueryResult.data = mockDocuments;
    render(<DocumentsTab companyId="c1" />);
    const deleteButtons = screen.getAllByLabelText('Delete');
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
  });

  it('closes confirm dialog when cancel is clicked', () => {
    mockQueryResult.data = mockDocuments;
    render(<DocumentsTab companyId="c1" />);
    const deleteButtons = screen.getAllByLabelText('Delete');
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cancel-delete'));
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  it('calls mutate when confirm delete is clicked', () => {
    mockQueryResult.data = mockDocuments;
    render(<DocumentsTab companyId="c1" />);
    const deleteButtons = screen.getAllByLabelText('Delete');
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByTestId('confirm-delete'));
    expect(mockMutate).toHaveBeenCalledWith('doc1');
  });

  it('renders export button', () => {
    render(<DocumentsTab companyId="c1" />);
    const exportBtn = screen.getByLabelText('exportPdf');
    expect(exportBtn).toBeInTheDocument();
  });

  it('disables export button when no documents', () => {
    mockQueryResult.data = [];
    render(<DocumentsTab companyId="c1" />);
    const exportBtn = screen.getByLabelText('exportPdf');
    expect(exportBtn).toBeDisabled();
  });

  it('formats date as dd/mm/yyyy', () => {
    mockQueryResult.data = [mockDocuments[0]];
    render(<DocumentsTab companyId="c1" />);
    // 2026-02-15 in en-AU format -> 15/02/2026
    expect(screen.getByText(/15\/02\/2026/)).toBeInTheDocument();
  });

  it('triggers file input click when add document button is clicked', () => {
    render(<DocumentsTab companyId="c1" />);
    const addButton = screen.getByText('addDocument');
    // The button triggers fileInputRef.current?.click() — we just verify no error on click
    fireEvent.click(addButton);
    // The hidden input should exist in the DOM
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
  });

  it('calls upload mutate when a file is selected', () => {
    render(<DocumentsTab companyId="c1" />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const testFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    expect(mockMutate).toHaveBeenCalledWith(testFile);
  });

  it('does not call mutate when file input change has no files', () => {
    render(<DocumentsTab companyId="c1" />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('calls handleView when view button is clicked', () => {
    mockQueryResult.data = mockDocuments;
    // Mock window.open
    const mockOpen = vi.spyOn(window, 'open').mockReturnValue({ location: { href: '' } } as any);
    mockGetFileUrl.mockResolvedValue({ url: 'https://example.com/file.pdf' });
    render(<DocumentsTab companyId="c1" />);
    const viewButtons = screen.getAllByLabelText('View');
    fireEvent.click(viewButtons[0]);
    expect(mockOpen).toHaveBeenCalledWith('', '_blank');
    mockOpen.mockRestore();
  });

  it('calls handleExport when export button is clicked', () => {
    mockQueryResult.data = mockDocuments;
    const mockOpen = vi.spyOn(window, 'open').mockReturnValue({ location: { href: '' } } as any);
    mockExportCompanyDocuments.mockResolvedValue({ url: 'https://example.com/export.pdf' });
    render(<DocumentsTab companyId="c1" />);
    const exportBtn = screen.getByLabelText('exportPdf');
    fireEvent.click(exportBtn);
    expect(mockOpen).toHaveBeenCalledWith('', '_blank');
    mockOpen.mockRestore();
  });

  it('does not open delete dialog when already deleting', () => {
    mockQueryResult.data = mockDocuments;
    render(<DocumentsTab companyId="c1" />);
    const deleteButtons = screen.getAllByLabelText('Delete');
    // First delete opens confirm
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    // Confirm delete to set deletingId
    fireEvent.click(screen.getByTestId('confirm-delete'));
    // Now clicking delete on second doc should not open a new dialog (deletingId is set)
    fireEvent.click(deleteButtons[1]);
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  it('exercises upload mutation onSuccess callback', () => {
    capturedOnSuccessCallbacks.length = 0;
    render(<DocumentsTab companyId="c1" />);
    // The first useMutation call is for upload, second for delete
    const uploadOnSuccess = capturedOnSuccessCallbacks[0];
    if (uploadOnSuccess) {
      uploadOnSuccess();
    }
  });

  it('exercises delete mutation onSuccess callback', () => {
    capturedOnSuccessCallbacks.length = 0;
    mockQueryResult.data = mockDocuments;
    render(<DocumentsTab companyId="c1" />);
    // The second useMutation call is for delete
    const deleteOnSuccess = capturedOnSuccessCallbacks[1];
    if (deleteOnSuccess) {
      deleteOnSuccess();
    }
  });

  it('handles view when window.open returns null', () => {
    mockQueryResult.data = mockDocuments;
    const mockOpen = vi.spyOn(window, 'open').mockReturnValue(null);
    mockGetFileUrl.mockResolvedValue({ url: 'https://example.com/file.pdf' });
    render(<DocumentsTab companyId="c1" />);
    const viewButtons = screen.getAllByLabelText('View');
    fireEvent.click(viewButtons[0]);
    expect(mockOpen).toHaveBeenCalledWith('', '_blank');
    mockOpen.mockRestore();
  });

  it('handles export when window.open returns null', () => {
    mockQueryResult.data = mockDocuments;
    const mockOpen = vi.spyOn(window, 'open').mockReturnValue(null);
    mockExportCompanyDocuments.mockResolvedValue({ url: 'https://example.com/export.pdf' });
    render(<DocumentsTab companyId="c1" />);
    const exportBtn = screen.getByLabelText('exportPdf');
    fireEvent.click(exportBtn);
    expect(mockOpen).toHaveBeenCalledWith('', '_blank');
    mockOpen.mockRestore();
  });
});
