import {
  getCompanyDocuments,
  uploadCompanyDocument,
  deleteCompanyDocument,
  downloadFile,
  openFileInNewTab,
  type CompanyDocumentResponse,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Button,
  Spinner,
  EmptyState,
  ConfirmDialog,
  notificationService,
} from '@forethread/ui-components';
import ClockIcon from '@forethread/ui-components/assets/icons/clock.svg?react';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import DownloadIcon from '@forethread/ui-components/assets/icons/download.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import PaperclipIcon from '@forethread/ui-components/assets/icons/paperclip.svg?react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

const DOCS_KEY = 'company-documents';

interface DocumentsTabProps {
  companyId: string;
}

export function DocumentsTab({ companyId }: DocumentsTabProps) {
  const { t } = useTranslation(['company', 'common']);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<CompanyDocumentResponse | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: [DOCS_KEY, companyId],
    queryFn: () => getCompanyDocuments(companyId),
    enabled: Boolean(companyId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadCompanyDocument(companyId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [DOCS_KEY, companyId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => deleteCompanyDocument(companyId, docId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [DOCS_KEY, companyId] });
      notificationService.success(t('documentDeleted'));
      setDeletingId(null);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
      e.target.value = '';
    }
  };

  const handleView = (fileId: string) => {
    void openFileInNewTab(fileId);
  };

  const handleDownload = (fileId: string, fileName: string) => {
    void downloadFile(fileId, fileName);
  };

  const handleDelete = (doc: CompanyDocumentResponse) => {
    if (deletingId) return;
    setDocToDelete(doc);
  };

  const confirmDelete = () => {
    if (!docToDelete) return;
    setDeletingId(docToDelete.id);
    deleteMutation.mutate(docToDelete.id);
    setDocToDelete(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between pb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('documentsTitle')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t('documentsSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
            disabled={uploadMutation.isPending}
          >
            <PaperclipIcon className="w-4 h-4" />
            {uploadMutation.isPending ? t('uploading') : t('addDocument')}
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Spinner size="md" />
        </div>
      ) : !documents?.length ? (
        <div className="py-12">
          <EmptyState title={t('noDocuments')} />
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const uploaderEmail = doc.file.uploadedBy?.email ?? '—';
            return (
              <div
                key={doc.id}
                className="flex items-center gap-4 rounded-lg border border-border px-4 py-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {doc.file.filename}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium uppercase text-foreground">
                      {uploaderEmail.slice(0, 2)}
                    </span>
                    <span className="truncate">{uploaderEmail}</span>
                    <ClockIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>{formatDate(doc.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="View"
                    onClick={() => handleView(doc.file.id)}
                  >
                    <EyeIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Download"
                    onClick={() => handleDownload(doc.file.id, doc.file.filename)}
                  >
                    <DownloadIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Delete"
                    onClick={() => handleDelete(doc)}
                    disabled={deleteMutation.isPending && deletingId === doc.id}
                  >
                    <DeleteIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {docToDelete && (
        <ConfirmDialog
          title={t('deleteDocumentTitle', { defaultValue: 'Delete document' })}
          message={t('deleteConfirm')}
          confirmLabel={t('common:delete', { defaultValue: 'Delete' })}
          cancelLabel={t('common:cancel', { defaultValue: 'Cancel' })}
          confirmVariant="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          onConfirm={confirmDelete}
          onCancel={() => setDocToDelete(null)}
        />
      )}
    </>
  );
}
