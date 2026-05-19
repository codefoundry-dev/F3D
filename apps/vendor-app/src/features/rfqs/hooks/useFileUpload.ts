import { getApiClient } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { useCallback, useState } from 'react';

const ALLOWED_EXTENSIONS = ['.pdf', '.xlsx', '.docx', '.jpg', '.jpeg', '.csv'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

interface UploadedFile {
  id: string;
  name: string;
}

export function useFileUpload(initialAttachments?: UploadedFile[]) {
  const { t } = useTranslation('rfqs');
  const [attachments, setAttachments] = useState<UploadedFile[]>(initialAttachments ?? []);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = useCallback(
    async (file: File, onAddId: (id: string) => void) => {
      setUploadError(null);

      const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setUploadError(t('response.invalidFileType'));
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setUploadError(t('response.fileTooLarge'));
        return;
      }

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await getApiClient().post<{ data: { id: string } }>(
          '/storage/upload',
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );
        const fileId = data.data.id;
        setAttachments((prev) => [...prev, { id: fileId, name: file.name }]);
        onAddId(fileId);
      } catch {
        setUploadError(t('response.uploadError'));
      } finally {
        setIsUploading(false);
      }
    },
    [t],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { attachments, uploadError, isUploading, handleFileUpload, removeAttachment };
}
