import {
  type RfqDocument,
  uploadRfqDocument,
  deleteRfqDocument,
  openFileInNewTab,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Button } from '@forethread/ui-components';
import UploadIcon from '@forethread/ui-components/assets/icons/upload.svg?react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { DocumentRow } from './DocumentCard';

interface RfqDocumentsTabProps {
  rfqId: string;
  documents: RfqDocument[];
  /** Hide the upload button (documents are view/delete only) */
  hideUpload?: boolean;
}

export function RfqDocumentsTab({ rfqId, documents, hideUpload }: RfqDocumentsTabProps) {
  const { t } = useTranslation('rfqs');
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadRfqDocument(rfqId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rfqs', rfqId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => deleteRfqDocument(rfqId, docId),
    onSuccess: () => {
      setDeletingId(null);
      void queryClient.invalidateQueries({ queryKey: ['rfqs', rfqId] });
    },
    onError: () => setDeletingId(null),
  });

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
      setDeletingId(doc.id);
      deleteMutation.mutate(doc.id);
    },
    [deleteMutation],
  );

  return (
    <div className="space-y-4">
      {!hideUpload && (
        <div className="flex justify-end">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.svg"
          />
          <Button
            variant="outline"
            size="sm"
            leftIcon={<UploadIcon className="w-4 h-4" />}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? t('documentsTab.uploading') : t('documentsTab.upload')}
          </Button>
        </div>
      )}

      {(!documents || documents.length === 0) && !uploadMutation.isPending ? (
        <div className="text-center py-12 text-muted-foreground">
          {t('documentsTab.noDocuments')}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              onView={handleView}
              onDelete={hideUpload ? undefined : handleDelete}
              isDeleting={deletingId === doc.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
