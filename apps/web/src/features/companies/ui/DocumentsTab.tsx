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
  EmptyBoxIllustration,
  ConfirmDialog,
  DotActionsMenu,
  notificationService,
  type DotAction,
} from '@forethread/ui-components';
import DownloadIcon from '@forethread/ui-components/assets/icons/download.svg?react';
import FileTextIcon from '@forethread/ui-components/assets/icons/file-text.svg?react';
import PaperclipIcon from '@forethread/ui-components/assets/icons/paperclip.svg?react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

const DOCS_KEY = 'company-documents';

/** 28px gradient-white bordered icon button (card-level ⋮ trigger). */
const ICON_BTN_28 =
  'flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-[#e8eaed] bg-gradient-to-b from-[#F9F9FA] to-white text-gray-600 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)] transition-colors hover:bg-none hover:bg-gray-50 hover:text-gray-900';

interface DocumentsTabProps {
  companyId: string;
}

/** File-type label + accent colour, derived from the filename extension. */
function fileTypeMeta(filename: string): { label: string; colorClass: string } {
  const ext = filename.split('.').pop()?.toUpperCase() ?? '';
  if (ext === 'PDF') return { label: 'PDF', colorClass: 'text-red-500' };
  if (['DOC', 'DOCX'].includes(ext)) return { label: ext, colorClass: 'text-blue-500' };
  if (['XLS', 'XLSX', 'CSV'].includes(ext)) return { label: ext, colorClass: 'text-green-600' };
  if (['PNG', 'JPG', 'JPEG', 'SVG', 'WEBP', 'GIF'].includes(ext))
    return { label: ext, colorClass: 'text-purple-500' };
  return { label: ext || 'FILE', colorClass: 'text-gray-500' };
}

function formatSize(bytes: number | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsTab({ companyId }: DocumentsTabProps) {
  const { t } = useTranslation(['company', 'common']);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleDownloadAll = () => {
    documents?.forEach((doc) => downloadFile(doc.file.id, doc.file.filename));
  };

  const confirmDelete = () => {
    if (!docToDelete) return;
    deleteMutation.mutate(docToDelete.id);
    setDocToDelete(null);
  };

  const getCardActions = (doc: CompanyDocumentResponse): DotAction[] => [
    { key: 'view', label: t('viewDocument'), onClick: () => handleView(doc.file.id) },
    {
      key: 'download',
      label: t('downloadDocument'),
      onClick: () => handleDownload(doc.file.id, doc.file.filename),
    },
    {
      key: 'delete',
      label: t('common:delete', { defaultValue: 'Delete' }),
      onClick: () => setDocToDelete(doc),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Header: total count + Add / Download all */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2">
        <p className="text-sm font-medium leading-[1.4] tracking-[0.3px] text-gray-700">
          {t('documentsCountLabel', { count: documents?.length ?? 0 })}
        </p>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            leftIcon={<PaperclipIcon className="size-4" />}
          >
            {uploadMutation.isPending ? t('uploading') : t('addDocument')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownloadAll}
            disabled={!documents?.length}
            leftIcon={<DownloadIcon className="size-4" />}
          >
            {t('downloadAll')}
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : !documents?.length ? (
        <div className="flex items-center justify-center rounded-[10px] border border-gray-100 bg-white py-6 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
          <EmptyState illustration={<EmptyBoxIllustration />} title={t('noDocuments')} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {documents.map((doc) => {
            const meta = fileTypeMeta(doc.file.filename);
            const size = formatSize(doc.file.size);
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-[12px] border border-[#e8eaed] bg-white px-[9px] py-[7px] shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]"
              >
                <span className={`flex size-10 shrink-0 items-center justify-center ${meta.colorClass}`}>
                  <FileTextIcon className="size-8" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate text-sm font-semibold leading-none tracking-[0.3px] text-[#2d3139]">
                    {doc.file.filename}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs font-normal leading-[1.4] tracking-[0.3px] text-[#2d3139]">
                    <span>{meta.label}</span>
                    {size && (
                      <>
                        <span className="h-3.5 w-px bg-gray-200" />
                        <span>{size}</span>
                      </>
                    )}
                  </div>
                </div>
                <DotActionsMenu
                  actions={getCardActions(doc)}
                  bordered={false}
                  triggerClassName={ICON_BTN_28}
                />
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
    </div>
  );
}
