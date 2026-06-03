import { useTranslation } from '@forethread/i18n';
import { Alert, FileChip, FileDropzone, Spinner } from '@forethread/ui-components';
import { useCallback, useState } from 'react';

import type { ExtractionPhase } from '../hooks/useQuoteExtraction';

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];
const ACCEPT_STRING = '.pdf,.png,.jpg,.jpeg';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export interface QuoteUploadPanelProps {
  phase: ExtractionPhase;
  fileName: string | null;
  itemCount: number;
  uploadError: string | null;
  onUpload: (file: File) => void;
}

/**
 * The "upload your quote PDF" entry point for the vendor portal (FOR-206).
 * Owns the dropzone + extraction status; once the phase is `completed` the
 * parent renders the (pre-filled) line-item table for review.
 */
export function QuoteUploadPanel({
  phase,
  fileName,
  itemCount,
  uploadError,
  onUpload,
}: QuoteUploadPanelProps) {
  const { t } = useTranslation('rfqs');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const file = files instanceof FileList ? files[0] : files[0];
      if (!file) return;

      const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        setValidationError(t('guest.uploadInvalidType'));
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setValidationError(t('guest.uploadTooLarge'));
        return;
      }
      setValidationError(null);
      onUpload(file);
    },
    [onUpload, t],
  );

  const busy = phase === 'uploading' || phase === 'processing';
  const error = validationError ?? uploadError;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-base font-medium text-foreground mb-1">{t('guest.uploadTitle')}</h2>
      <p className="text-sm text-muted-foreground mb-4">{t('guest.modeUploadHint')}</p>

      {busy ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-6">
          <Spinner size="md" />
          <div>
            <p className="text-sm font-medium text-foreground">{t('guest.extracting')}</p>
            {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
          </div>
        </div>
      ) : (
        <FileDropzone
          onFiles={handleFiles}
          accept={ACCEPT_STRING}
          buttonLabel={t('guest.uploadDropzone')}
          hint={t('guest.uploadFormats')}
        />
      )}

      {error && !busy && <p className="mt-2 text-sm text-destructive">{error}</p>}

      {phase === 'failed' && !validationError && (
        <Alert variant="destructive" className="mt-3">
          <p className="font-medium">{t('guest.extractionFailed')}</p>
          <p className="text-sm">{t('guest.extractionFailedHint')}</p>
        </Alert>
      )}

      {phase === 'completed' && (
        <div className="mt-3 space-y-2">
          <Alert variant="success">{t('guest.extractionReady', { count: itemCount })}</Alert>
          {fileName && (
            <div className="flex items-center justify-between gap-3">
              <FileChip name={fileName} />
              <p className="text-xs text-muted-foreground">{t('guest.sourceAttached')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
