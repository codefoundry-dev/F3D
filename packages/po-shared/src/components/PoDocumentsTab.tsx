import { type PoDocumentDetail, type RfqDocument, openFileInNewTab } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { DocumentRow } from '@forethread/rfq-shared';
import { Button } from '@forethread/ui-components';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import UploadIcon from '@forethread/ui-components/assets/icons/upload.svg?react';
import { useCallback, useRef } from 'react';

import { usePoDocumentMutations } from '../hooks/usePoDocumentMutations';

export interface RelatedDocument {
  id: string;
  label: string;
  url: string;
}

interface PoDocumentsTabProps {
  poId: string;
  documents: PoDocumentDetail[];
  /** Hide the upload button (documents are view/delete only) */
  hideUpload?: boolean;
  /** Related procurement documents (RFQ, Invoice, Bulk Order) shown in a separate section */
  relatedDocuments?: RelatedDocument[];
}

export function PoDocumentsTab({
  poId,
  documents,
  hideUpload,
  relatedDocuments,
}: PoDocumentsTabProps) {
  const { t } = useTranslation('purchaseOrders');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadMutation, deletingId, deleteDocument, isUploading } = usePoDocumentMutations(poId);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        uploadMutation.mutate(file);
        e.target.value = '';
      }
    },
    [uploadMutation],
  );

  const handleView = useCallback(async (doc: RfqDocument) => {
    if (doc.fileId) {
      await openFileInNewTab(doc.fileId);
    }
  }, []);

  const handleDelete = useCallback(
    (doc: RfqDocument) => {
      deleteDocument(doc.id);
    },
    [deleteDocument],
  );

  return (
    <div className="space-y-4">
      {/* Related Documents section */}
      {relatedDocuments && relatedDocuments.length > 0 && (
        <div className="rounded-[10px] border border-foreground/10 p-4">
          <p className="text-base font-bold text-foreground mb-4">
            {t('documentsTab.relatedDocuments')}
          </p>
          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto">
            {relatedDocuments.map((rd) => (
              <div
                key={rd.id}
                className="flex items-center justify-between flex-1 rounded-[10px] border border-foreground/10 px-4 py-4"
              >
                <p className="text-sm font-medium text-foreground">{rd.label}</p>
                <button
                  type="button"
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  onClick={() => window.open(rd.url, '_blank')}
                >
                  <EyeIcon className="w-6 h-6" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attached Documents section */}
      <div className="rounded-[10px] border border-foreground/10 p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-base font-bold text-foreground">
            {t('documentsTab.attachedDocuments')}
          </p>
          {!hideUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.svg,.xlsx,.csv"
              />
              <Button
                variant="outline"
                size="sm"
                leftIcon={<UploadIcon className="w-4 h-4" />}
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? t('documentsTab.uploading') : t('documentsTab.upload')}
              </Button>
            </>
          )}
        </div>

        {(!documents || documents.length === 0) && !isUploading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {t('documentsTab.noDocuments')}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {documents.map((doc) => (
              <div key={doc.id} className="border border-foreground/10 rounded-[10px]">
                <DocumentRow
                  doc={doc as unknown as RfqDocument}
                  onView={handleView}
                  onDelete={handleDelete}
                  isDeleting={deletingId === doc.id}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
