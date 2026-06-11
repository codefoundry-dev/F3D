import { updateDocExtraction } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  type CatalogueExtractionResult,
  isCatalogueExtractionResult,
} from '@forethread/shared-types/client';
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  notificationService,
} from '@forethread/ui-components';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useCreateDocExtraction, useDocExtractionQuery } from '../../doc-intelligence';
import { useCatalogueImport } from '../hooks/useCatalogueImport';

import { CatalogueReviewTable } from './CatalogueReviewTable';

export interface CatalogueImportModalProps {
  onClose: () => void;
  /** Fired after a successful import so the page can refresh the catalogue. */
  onImported?: () => void;
}

/** Accepted upload types for a catalogue (CSV is NOT supported yet — FOR-228). */
const ACCEPT_EXTENSIONS = ['.xlsx', '.pdf', '.png', '.jpg', '.jpeg', '.webp'];
const XLSX_EXT = '.xlsx';
const MAX_XLSX_BYTES = 30 * 1024 * 1024;
const MAX_OTHER_BYTES = 10 * 1024 * 1024;

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

/**
 * Catalogue ingest flow (FOR-228): upload a spreadsheet/PDF/image, poll the
 * extraction, review/edit the rows, then import. Reuses the doc-intelligence
 * upload + poll hooks (`useCreateDocExtraction`, `useDocExtractionQuery`) with
 * `type: 'CATALOGUE'`. The import endpoint reads the server-stored result and
 * confirms the extraction itself, so edits are only PATCHed back when the user
 * actually changed a row — the common no-edit path ships no large payload.
 */
export function CatalogueImportModal({ onClose, onImported }: CatalogueImportModalProps) {
  const { t } = useTranslation(['materialCatalogue']);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  // Canonical, in-memory edited result. Held here (not the table) so edits don't
  // deep-clone the whole array each render.
  const [draft, setDraft] = useState<CatalogueExtractionResult | null>(null);
  // Whether the user edited any rows. When false, we skip persisting the draft
  // back to the server on import (it already has the parsed result), avoiding a
  // multi-MB request for the common no-edit path.
  const [dirty, setDirty] = useState(false);
  const [persisting, setPersisting] = useState(false);

  const create = useCreateDocExtraction();
  const query = useDocExtractionQuery(extractionId);
  const importMutation = useCatalogueImport();
  const job = query.data;

  // Seed the editable draft once the extraction completes.
  useEffect(() => {
    if (job?.status === 'COMPLETED' && job.editedResult && draft === null) {
      const result = isCatalogueExtractionResult(job.editedResult)
        ? job.editedResult
        : { sourceName: null, items: [], notes: null };
      setDraft(result);
    }
  }, [job?.status, job?.editedResult, draft]);

  const reset = useCallback(() => {
    setExtractionId(null);
    setFileError(null);
    setDraft(null);
    setDirty(false);
    setPersisting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const onFileSelected = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      setFileError(null);
      const ext = extensionOf(file.name);
      if (!ACCEPT_EXTENSIONS.includes(ext)) {
        setFileError(t('import.errors.unsupportedType'));
        return;
      }
      const maxBytes = ext === XLSX_EXT ? MAX_XLSX_BYTES : MAX_OTHER_BYTES;
      if (file.size > maxBytes) {
        setFileError(t('import.errors.tooLarge'));
        return;
      }
      create.mutate(
        { type: 'CATALOGUE', file },
        {
          onSuccess: (created) => setExtractionId(created.id),
          onError: () => setFileError(t('import.errors.uploadFailed')),
        },
      );
    },
    [create, t],
  );

  const isUploading = create.isPending;
  const isPolling = !!job && (job.status === 'PENDING' || job.status === 'PROCESSING');
  const isCompleted = job?.status === 'COMPLETED';
  const isFailed = job?.status === 'FAILED';
  const itemCount = draft?.items.length ?? 0;
  const isEmptyResult = isCompleted && draft !== null && itemCount === 0;

  const onConfirmImport = useCallback(async () => {
    if (!extractionId || !draft) return;
    try {
      // Only ship the edited result back when the user actually changed
      // something — the server already persisted the parsed result during the
      // direct parse, so the common no-edit path needs no large upload. The
      // import endpoint reads the stored result and confirms the extraction.
      if (dirty) {
        setPersisting(true);
        await updateDocExtraction(extractionId, draft as unknown as Record<string, unknown>, {
          timeout: 300_000,
        });
        setPersisting(false);
      }
      const summary = await importMutation.mutateAsync(extractionId);
      notificationService.success(
        t('import.success', {
          total: summary.total.toLocaleString(),
          created: summary.created.toLocaleString(),
          updated: summary.updated.toLocaleString(),
          categories: summary.categoriesCreated.toLocaleString(),
        }),
      );
      onImported?.();
      onClose();
    } catch {
      setPersisting(false);
      notificationService.error(t('import.errors.importFailed'));
    }
  }, [extractionId, draft, dirty, importMutation, t, onImported, onClose]);

  const isImporting = persisting || importMutation.isPending;

  const body = useMemo(() => {
    if (isFailed) {
      return (
        <div className="space-y-3 py-4" role="alert">
          <p className="text-sm text-destructive">
            {t('import.failed', {
              message: job?.errorMessage ?? job?.errorCode ?? '',
            })}
          </p>
          <Button variant="outline" onClick={reset} data-testid="catalogue-retry">
            {t('import.actions.tryAnotherFile')}
          </Button>
        </div>
      );
    }

    if (isEmptyResult) {
      return (
        <div className="space-y-3 py-4" data-testid="catalogue-empty">
          <p className="text-sm text-muted-foreground">{t('import.empty')}</p>
          <Button variant="outline" onClick={reset} data-testid="catalogue-retry">
            {t('import.actions.tryAnotherFile')}
          </Button>
        </div>
      );
    }

    if (isCompleted && draft) {
      return (
        <CatalogueReviewTable
          value={draft as unknown as Record<string, unknown>}
          onChange={(next) => {
            setDraft(next);
            setDirty(true);
          }}
        />
      );
    }

    if (isUploading || isPolling) {
      return (
        <div className="py-10 text-center text-sm text-muted-foreground" role="status">
          {isUploading ? t('import.uploading') : t('import.processing')}
        </div>
      );
    }

    // Idle — file picker.
    return (
      <div className="space-y-3 py-4">
        <p className="text-sm text-muted-foreground">{t('import.dropHint')}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_EXTENSIONS.join(',')}
          data-testid="catalogue-file-input"
          aria-label={t('import.fileLabel')}
          onChange={(e) => onFileSelected(e.target.files?.[0])}
        />
        {fileError ? (
          <p className="text-xs text-destructive" role="alert" data-testid="catalogue-file-error">
            {fileError}
          </p>
        ) : null}
      </div>
    );
  }, [
    isFailed,
    isEmptyResult,
    isCompleted,
    draft,
    isUploading,
    isPolling,
    job?.errorMessage,
    job?.errorCode,
    fileError,
    onFileSelected,
    reset,
    t,
  ]);

  return (
    <Modal onClose={onClose} maxWidth="max-w-4xl" scrollBody>
      <ModalHeader onClose={onClose}>{t('import.title')}</ModalHeader>
      {/* Pinned layout: header + footer stay fixed; only this body scrolls.
          `toolbar:overflow-y-auto` overrides the shared ModalBody's desktop
          `overflow-visible` (tailwind-merge, last-wins) and the bounded height
          keeps the card within 90vh so the footer is always visible. */}
      <ModalBody className="toolbar:flex-1 toolbar:min-h-0 toolbar:overflow-y-auto">
        {body}
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          {t('import.actions.cancel')}
        </Button>
        {isCompleted && !isEmptyResult ? (
          <Button
            onClick={() => void onConfirmImport()}
            disabled={isImporting || itemCount === 0}
            data-testid="catalogue-import-confirm"
          >
            {isImporting
              ? t('import.actions.importing')
              : t('import.actions.import', { count: itemCount })}
          </Button>
        ) : null}
      </ModalFooter>
    </Modal>
  );
}
