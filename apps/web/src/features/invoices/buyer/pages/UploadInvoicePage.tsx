import { useTranslation } from '@forethread/i18n';
import { useInvoiceIntakeAddress, useUploadInvoice } from '@forethread/invoice-shared';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { Alert, Button, notificationService } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import CopyIcon from '@forethread/ui-components/assets/icons/copy.svg?react';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import FileTextIcon from '@forethread/ui-components/assets/icons/file-text.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import SpinnerIcon from '@forethread/ui-components/assets/icons/spinner.svg?react';
import UploadIcon from '@forethread/ui-components/assets/icons/upload.svg?react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

const ACCEPT_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
const MAX_BYTES = 10 * 1024 * 1024;

type QueuedStatus = 'queued' | 'uploading' | 'done' | 'failed';

interface QueuedFile {
  /** Local queue key — files can share names. */
  key: string;
  file: File;
  status: QueuedStatus;
  /** The created invoice id once the upload succeeded. */
  invoiceId?: string;
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

/**
 * Manual invoice intake (FOR-290): every uploaded file becomes its own Pending
 * invoice for review (FOR-291) to fill in. The page also surfaces the
 * company's email-intake address so the team can hand it to vendors.
 */
export default function UploadInvoicePage() {
  const { t } = useTranslation('invoices');
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadInvoice();
  const intakeAddress = useInvoiceIntakeAddress();

  // App-bar breadcrumb: Invoices › Upload Invoice.
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(t('upload.title'), null, ROUTES.invoices, [
      { label: t('list.title'), to: ROUTES.invoices },
      { label: t('upload.title') },
    ]);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const keyCounter = useRef(0);

  const onFilesSelected = useCallback(
    (selected: FileList | null | undefined) => {
      if (!selected || selected.length === 0) return;
      setFileError(null);
      const accepted: QueuedFile[] = [];
      for (const file of Array.from(selected)) {
        if (!ACCEPT_EXTENSIONS.includes(extensionOf(file.name))) {
          setFileError(t('upload.errors.unsupportedType'));
          continue;
        }
        if (file.size > MAX_BYTES) {
          setFileError(t('upload.errors.tooLarge'));
          continue;
        }
        keyCounter.current += 1;
        accepted.push({ key: `f${keyCounter.current}`, file, status: 'queued' });
      }
      if (accepted.length > 0) setQueue((prev) => [...prev, ...accepted]);
    },
    [t],
  );

  const removeFile = useCallback((key: string) => {
    setQueue((prev) => prev.filter((q) => q.key !== key));
  }, []);

  const setStatus = useCallback((key: string, status: QueuedStatus, invoiceId?: string) => {
    setQueue((prev) => prev.map((q) => (q.key === key ? { ...q, status, invoiceId } : q)));
  }, []);

  const pendingCount = queue.filter((q) => q.status === 'queued' || q.status === 'failed').length;

  // Sequential on purpose: each file is its own invoice + S3 upload, and one
  // failing must not abort the rest.
  const onUploadAll = useCallback(async () => {
    const toUpload = queue.filter((q) => q.status === 'queued' || q.status === 'failed');
    if (toUpload.length === 0 || isUploading) return;
    setIsUploading(true);
    let done = 0;
    for (const entry of toUpload) {
      setStatus(entry.key, 'uploading');
      try {
        const created = await upload.mutateAsync(entry.file);
        setStatus(entry.key, 'done', created.id);
        done += 1;
      } catch {
        setStatus(entry.key, 'failed');
      }
    }
    setIsUploading(false);
    if (done === toUpload.length) {
      notificationService.success(t('upload.successToast', { count: done }));
    } else {
      notificationService.error(t('upload.partialToast', { done, total: toUpload.length }));
    }
  }, [queue, isUploading, upload, setStatus, t]);

  const copyIntakeAddress = useCallback(() => {
    const email = intakeAddress.data?.email;
    if (!email) return;
    void navigator.clipboard.writeText(email).then(() => {
      notificationService.success(t('upload.inbox.copied'));
    });
  }, [intakeAddress.data?.email, t]);

  return (
    <div className="p-8" data-testid="upload-invoice-page">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <UploadIcon className="size-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold text-foreground">{t('upload.title')}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(ROUTES.invoices)}
            data-testid="upload-invoice-back"
          >
            {t('upload.goToInvoices')}
          </Button>
          <Button
            disabled={pendingCount === 0 || isUploading}
            isLoading={isUploading}
            onClick={() => void onUploadAll()}
            data-testid="upload-invoice-submit"
          >
            {isUploading ? t('upload.uploading') : t('upload.uploadCount', { count: pendingCount })}
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {/* ── Dropzone card ─────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-base font-semibold text-foreground">{t('upload.cardTitle')}</h3>

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFilesSelected(e.dataTransfer.files);
            }}
            data-testid="upload-invoice-dropzone"
            className="mt-4 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-6 py-14 text-center transition-colors hover:border-foreground/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="mb-1 flex size-10 items-center justify-center rounded-[10px] border border-[#e8eaed] bg-[#f9f9fa] text-indigo-600 shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)]">
              <FileTextIcon className="size-5" aria-hidden />
            </span>
            <p className="text-sm text-foreground">
              {t('upload.dropTitle')}{' '}
              <span className="font-semibold text-foreground underline">{t('upload.browse')}</span>
            </p>
            <p className="text-xs text-muted-foreground">{t('upload.dropFormats')}</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT_EXTENSIONS.join(',')}
              className="sr-only"
              data-testid="upload-invoice-file-input"
              aria-label={t('upload.cardTitle')}
              onChange={(e) => {
                onFilesSelected(e.target.files);
                // Selecting the same file again must re-fire onChange.
                e.target.value = '';
              }}
            />
          </div>

          {fileError ? (
            <p
              className="mt-3 text-xs text-destructive"
              role="alert"
              data-testid="upload-invoice-file-error"
            >
              {fileError}
            </p>
          ) : null}

          {/* ── File queue ────────────────────────────────────────────── */}
          {queue.length > 0 ? (
            <ul className="mt-4 space-y-2" data-testid="upload-invoice-queue">
              {queue.map((entry) => (
                <li
                  key={entry.key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#e8eaed] bg-white px-3 py-2.5"
                  data-testid={`upload-invoice-file-${entry.status}`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FileTextIcon className="size-7 shrink-0 text-[#d92d20]" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {entry.file.name}
                      </p>
                      <p
                        className={`text-xs ${
                          entry.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'
                        }`}
                      >
                        {extensionOf(entry.file.name).replace('.', '').toUpperCase()} ·{' '}
                        {t(`upload.status.${entry.status}` as never)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {entry.status === 'uploading' ? (
                      <SpinnerIcon
                        className="size-4 animate-spin text-muted-foreground"
                        aria-hidden
                      />
                    ) : null}
                    {entry.status === 'done' ? (
                      <>
                        <CheckCircleIcon className="size-5 text-success-600" aria-hidden />
                        {entry.invoiceId ? (
                          <Button
                            variant="outline"
                            size="sm"
                            data-testid={`upload-invoice-view-${entry.key}`}
                            onClick={() =>
                              navigate(ROUTES.invoiceDetail.replace(':id', entry.invoiceId ?? ''))
                            }
                          >
                            {t('upload.viewInvoice')}
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                    {entry.status === 'queued' || entry.status === 'failed' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        aria-label={t('upload.removeFile', { name: entry.file.name })}
                        data-testid={`upload-invoice-remove-${entry.key}`}
                        onClick={() => removeFile(entry.key)}
                      >
                        <CrossIcon className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {/* ── Email-intake address ──────────────────────────────────────── */}
        {intakeAddress.data?.email ? (
          <section
            className="rounded-2xl border border-border bg-card p-6"
            data-testid="upload-invoice-inbox"
          >
            <div className="flex items-center gap-2.5">
              <EnvelopeIcon className="size-5 text-muted-foreground" aria-hidden />
              <h3 className="text-base font-semibold text-foreground">{t('upload.inbox.title')}</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t('upload.inbox.description')}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code
                className="rounded-lg border border-[#e8eaed] bg-[#f9f9fa] px-3 py-2 text-sm text-foreground"
                data-testid="upload-invoice-inbox-address"
              >
                {intakeAddress.data.email}
              </code>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<CopyIcon className="size-4" />}
                onClick={copyIntakeAddress}
                data-testid="upload-invoice-inbox-copy"
              >
                {t('upload.inbox.copy')}
              </Button>
            </div>
          </section>
        ) : null}

        <Alert variant="info" icon={<InfoIcon className="h-4 w-4" />}>
          {t('upload.hint')}
        </Alert>
      </div>
    </div>
  );
}
