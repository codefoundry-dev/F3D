import { useTranslation } from '@forethread/i18n';
import { DatePicker, FileChip, FileDropzone, Input } from '@forethread/ui-components';
import { useCallback } from 'react';

const ALLOWED_EXTENSIONS = ['.pdf', '.xlsx', '.docx', '.jpg', '.jpeg', '.csv'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPT_STRING = '.pdf,.xlsx,.docx,.jpg,.jpeg,.csv';

export interface AdditionalQuoteDetailsProps {
  validityPeriod: string;
  onValidityPeriodChange: (v: string) => void;
  additionalNotes: string;
  onAdditionalNotesChange: (v: string) => void;
  attachments: Array<{ id: string; name: string }>;
  onFileUpload: (file: File) => void;
  onRemoveAttachment: (id: string) => void;
  uploadError: string | null;
  isUploading: boolean;
}

export function AdditionalQuoteDetails({
  validityPeriod,
  onValidityPeriodChange,
  additionalNotes,
  onAdditionalNotesChange,
  attachments,
  onFileUpload,
  onRemoveAttachment,
  uploadError,
  isUploading,
}: AdditionalQuoteDetailsProps) {
  const { t } = useTranslation('rfqs');

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const file = files instanceof FileList ? files[0] : files[0];
      if (!file) return;

      const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
      if (!ALLOWED_EXTENSIONS.includes(extension)) return;
      if (file.size > MAX_FILE_SIZE) return;

      onFileUpload(file);
    },
    [onFileUpload],
  );

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-base font-medium text-foreground mb-4">
        {t('response.additionalQuoteDetails')}
      </h2>

      {/* Row 1: Validity period + Additional notes */}
      <div className="grid grid-cols-[283px_1fr] gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t('response.validityPeriod')}
          </label>
          <DatePicker
            value={validityPeriod}
            onChange={onValidityPeriodChange}
            editable
            minDate={new Date().toISOString().slice(0, 10)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t('response.additionalNotes')}{' '}
            <span className="text-muted-foreground font-normal">{t('response.optional')}</span>
          </label>
          <Input
            value={additionalNotes}
            onChange={(e) => onAdditionalNotesChange(e.target.value)}
            placeholder={t('response.addMessage')}
            className="h-10"
          />
        </div>
      </div>

      {/* Row 2: Attachments */}
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">{t('response.attachments')}</h3>

        <FileDropzone
          onFiles={handleFiles}
          accept={ACCEPT_STRING}
          disabled={isUploading}
          buttonLabel={t('response.addAttachment')}
          hint={t('response.supportedFormats')}
        />

        {uploadError && <p className="mt-2 text-sm text-destructive">{uploadError}</p>}

        {attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {attachments.map((attachment) => (
              <FileChip
                key={attachment.id}
                name={attachment.name}
                onRemove={() => onRemoveAttachment(attachment.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
