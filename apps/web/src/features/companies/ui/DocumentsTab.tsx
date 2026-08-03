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
import { useEffect, useRef, useState } from 'react';

import { DocumentReviewModal } from './DocumentReviewModal';

const DOCS_KEY = 'company-documents';

/** Poll cadence while an upload's extraction is still running (FOR-260). */
const EXTRACTION_POLL_MS = 3000;
/** Stop waiting for a fresh upload's extraction to appear after this long —
 *  no extraction row is ever created when the pipeline is not configured. */
const EXTRACTION_WAIT_MS = 60_000;
/** Upload types with an extraction path (mirrors the backend's Gemini-native
 *  set) — other types never produce data to review, so don't wait on them. */
const EXTRACTABLE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

/** The extraction finished and nobody has approved its values yet. */
function needsReview(doc: CompanyDocumentResponse): boolean {
  return doc.extraction?.status === 'COMPLETED';
}

function extractionRunning(doc: CompanyDocumentResponse): boolean {
  return doc.extraction?.status === 'PENDING' || doc.extraction?.status === 'PROCESSING';
}

/** Mirrors the backend allow-list on POST /companies/:id/documents. */
const ALLOWED_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'csv',
  'jpg',
  'jpeg',
  'png',
  'webp',
];
const ACCEPT_ATTR = ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB — matches the backend limit

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
  const [docToReview, setDocToReview] = useState<CompanyDocumentResponse | null>(null);
  // The just-uploaded document whose extraction we are waiting on so the
  // review modal can open by itself when the extracted data is ready.
  const [pendingReview, setPendingReview] = useState<{ docId: string; until: number } | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: [DOCS_KEY, companyId],
    queryFn: () => getCompanyDocuments(companyId),
    enabled: Boolean(companyId),
    // Keep refreshing while an extraction runs (or while a fresh upload's
    // extraction row has yet to appear) so the review step can kick in.
    refetchInterval: (query) => {
      const docs = query.state.data;
      if (docs?.some(extractionRunning)) return EXTRACTION_POLL_MS;
      if (pendingReview && Date.now() < pendingReview.until) return EXTRACTION_POLL_MS;
      return false;
    },
  });

  // Auto-open the review modal once the awaited extraction completes.
  useEffect(() => {
    if (!pendingReview || !documents) return;
    const doc = documents.find((d) => d.id === pendingReview.docId);
    const status = doc?.extraction?.status;
    if (doc && status === 'COMPLETED') {
      setDocToReview(doc);
      setPendingReview(null);
    } else if (!doc || status === 'FAILED' || status === 'CONFIRMED') {
      setPendingReview(null);
    }
  }, [documents, pendingReview]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadCompanyDocument(companyId, file),
    onSuccess: (doc, file) => {
      void queryClient.invalidateQueries({ queryKey: [DOCS_KEY, companyId] });
      notificationService.success(t('documentUploaded'));
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (EXTRACTABLE_EXTENSIONS.includes(ext)) {
        setPendingReview({ docId: doc.id, until: Date.now() + EXTRACTION_WAIT_MS });
      }
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
    e.target.value = '';
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      notificationService.error(t('documentInvalidFormat'));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      notificationService.error(t('documentTooLarge'));
      return;
    }
    uploadMutation.mutate(file);
  };

  const handleView = (fileId: string) => {
    void openFileInNewTab(fileId);
  };

  const handleDownload = (fileId: string, fileName: string) => {
    void downloadFile(fileId, fileName);
  };

  const handleDownloadAll = () => {
    documents?.forEach((doc) => void downloadFile(doc.file.id, doc.file.filename));
  };

  const confirmDelete = () => {
    if (!docToDelete) return;
    deleteMutation.mutate(docToDelete.id);
    setDocToDelete(null);
  };

  const getCardActions = (doc: CompanyDocumentResponse): DotAction[] => [
    ...(needsReview(doc)
      ? [{ key: 'review', label: t('reviewDocumentAction'), onClick: () => setDocToReview(doc) }]
      : []),
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
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={handleFileChange}
          />
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
                <span
                  className={`flex size-10 shrink-0 items-center justify-center ${meta.colorClass}`}
                >
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
                {needsReview(doc) && (
                  <button
                    type="button"
                    onClick={() => setDocToReview(doc)}
                    className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold leading-none text-amber-700 transition-colors hover:bg-amber-100"
                  >
                    {t('reviewExtracted')}
                  </button>
                )}
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

      {docToReview && (
        <DocumentReviewModal
          companyId={companyId}
          document={docToReview}
          onClose={() => setDocToReview(null)}
          onApproved={() => {
            void queryClient.invalidateQueries({ queryKey: [DOCS_KEY, companyId] });
            setDocToReview(null);
          }}
        />
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
