import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components/assets/icons/clock.svg?react', () => ({
  default: (props: Record<string, unknown>) => <svg data-testid="icon-clock" {...props} />,
}));
vi.mock('@forethread/ui-components/assets/icons/delete.svg?react', () => ({
  default: (props: Record<string, unknown>) => <svg data-testid="icon-delete" {...props} />,
}));
vi.mock('@forethread/ui-components/assets/icons/download.svg?react', () => ({
  default: (props: Record<string, unknown>) => <svg data-testid="icon-download" {...props} />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: (props: Record<string, unknown>) => <svg data-testid="icon-eye" {...props} />,
}));
vi.mock('@forethread/ui-components/assets/icons/upload.svg?react', () => ({
  default: (props: Record<string, unknown>) => <svg data-testid="icon-upload" {...props} />,
}));
vi.mock('@forethread/ui-components/assets/icons/file-doc.svg?react', () => ({
  default: (props: Record<string, unknown>) => <svg data-testid="icon-file" {...props} />,
}));

vi.mock('@forethread/api-client', () => ({
  uploadRfqDocument: vi.fn(),
  deleteRfqDocument: vi.fn(),
  getFileUrl: vi.fn().mockResolvedValue({ url: 'https://example.com/file' }),
}));

import { RfqDocumentsTab } from './RfqDocumentsTab';

const MOCK_DOCUMENTS = [
  {
    id: 'DOC-001',
    name: 'Specifications.pdf',
    fileId: 'file-001',
    uploadedBy: {
      name: 'John Doe',
      email: 'john@example.com',
      avatarUrl: null,
    },
    uploadedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'DOC-002',
    name: 'Pricing Sheet.xlsx',
    fileId: 'file-002',
    uploadedBy: {
      name: 'Jane Smith',
      email: 'jane@example.com',
      avatarUrl: 'https://example.com/avatar.png',
    },
    uploadedAt: '2024-01-20T14:30:00Z',
  },
];

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('RfqDocumentsTab', () => {
  it('renders empty state when no documents', () => {
    render(<RfqDocumentsTab rfqId="rfq-1" documents={[]} />, { wrapper: createWrapper() });
    expect(screen.getByText('documentsTab.noDocuments')).toBeInTheDocument();
  });

  it('renders document cards', () => {
    render(<RfqDocumentsTab rfqId="rfq-1" documents={MOCK_DOCUMENTS} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText('Specifications.pdf')).toBeInTheDocument();
    expect(screen.getByText('Pricing Sheet.xlsx')).toBeInTheDocument();
  });

  it('renders uploader email', () => {
    render(<RfqDocumentsTab rfqId="rfq-1" documents={MOCK_DOCUMENTS} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('renders avatar initials for users without avatar', () => {
    render(<RfqDocumentsTab rfqId="rfq-1" documents={MOCK_DOCUMENTS} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders avatar image for users with avatar', () => {
    render(<RfqDocumentsTab rfqId="rfq-1" documents={MOCK_DOCUMENTS} />, {
      wrapper: createWrapper(),
    });
    const avatar = screen.getByAltText('Jane Smith');
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.png');
  });

  it('renders upload button', () => {
    render(<RfqDocumentsTab rfqId="rfq-1" documents={MOCK_DOCUMENTS} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText('documentsTab.upload')).toBeInTheDocument();
  });

  it('hides upload in hideUpload mode', () => {
    render(<RfqDocumentsTab rfqId="rfq-1" documents={MOCK_DOCUMENTS} hideUpload />, {
      wrapper: createWrapper(),
    });
    expect(screen.queryByText('documentsTab.upload')).not.toBeInTheDocument();
    expect(screen.queryByTitle('actions.delete')).not.toBeInTheDocument();
  });

  it('renders action buttons for each document', () => {
    render(<RfqDocumentsTab rfqId="rfq-1" documents={MOCK_DOCUMENTS} />, {
      wrapper: createWrapper(),
    });
    const viewButtons = screen.getAllByTitle('actions.view');
    const downloadButtons = screen.getAllByTitle('actions.download');
    const deleteButtons = screen.getAllByTitle('actions.delete');
    expect(viewButtons).toHaveLength(2);
    expect(downloadButtons).toHaveLength(2);
    expect(deleteButtons).toHaveLength(2);
  });
});
