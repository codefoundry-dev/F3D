import { useTranslation } from '@forethread/i18n';
import { Button, notificationService } from '@forethread/ui-components';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { DocExtractionReview, useCreateDocExtraction } from '@/features/doc-intelligence';

/**
 * PDF is the primary BOM format; images are accepted since Gemini is multimodal,
 * and Excel (.xlsx) workbooks are parsed to text server-side before extraction.
 */
const ACCEPTED_FILE_TYPES =
  '.pdf,.xlsx,image/png,image/jpeg,image/webp,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * "Convert a project BOM" entry point for RFQ creation (FOR-200): upload a BOM
 * document, let the document-intelligence pipeline extract structured line
 * items, then review/confirm them in {@link DocExtractionReview}. Reached from
 * the RFQ list "Create new → Converting a project BOM" menu.
 */
export default function BomConversionPage() {
  const { t } = useTranslation(['docExtractions']);
  const navigate = useNavigate();
  const createExtraction = useCreateDocExtraction();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [extractionId, setExtractionId] = useState<string | null>(null);

  const handleExtract = async () => {
    if (!file) return;
    try {
      const job = await createExtraction.mutateAsync({ type: 'BOM', file });
      setExtractionId(job.id);
    } catch (err) {
      notificationService.error(
        t('upload.error', { message: err instanceof Error ? err.message : '' }),
      );
    }
  };

  const handleConfirmed = () => {
    notificationService.success(t('upload.confirmed'));
    navigate(ROUTES.rfqs);
  };

  return (
    <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-8 mx-auto max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('upload.bomHeading')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('upload.bomSubheading')}</p>
        </div>
        <Button variant="outline" onClick={() => navigate(ROUTES.rfqs)}>
          {t('upload.back')}
        </Button>
      </div>

      {extractionId ? (
        <div className="rounded-lg border border-border bg-background">
          <DocExtractionReview extractionId={extractionId} onConfirmed={handleConfirmed} />
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-border bg-background p-6">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            className="hidden"
            data-testid="bom-file-input"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            aria-label={t('upload.title')}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) setFile(dropped);
            }}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-6 py-12 text-center transition-colors hover:border-primary hover:bg-muted/50"
          >
            <span className="text-sm font-medium text-foreground">
              {file ? file.name : t('upload.title')}
            </span>
            <span className="text-xs text-muted-foreground">
              {file ? t('upload.changeFile') : t('upload.dropHint')}
            </span>
          </button>

          <div className="flex justify-end">
            <Button
              onClick={() => void handleExtract()}
              disabled={!file || createExtraction.isPending}
              data-testid="bom-extract-submit"
            >
              {createExtraction.isPending ? t('upload.submitting') : t('upload.submit')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
