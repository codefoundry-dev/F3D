import { queryKeys, type MaterialDuplicateMatch } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { type CatalogueLineItem } from '@forethread/shared-types/client';
import {
  Alert,
  Button,
  Input,
  notificationService,
  TablePagination,
} from '@forethread/ui-components';
import CopyIcon from '@forethread/ui-components/assets/icons/copy.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import FileTextIcon from '@forethread/ui-components/assets/icons/file-text.svg?react';
import WarningIcon from '@forethread/ui-components/assets/icons/info-in-triangle.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import SpinnerIcon from '@forethread/ui-components/assets/icons/spinner.svg?react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import {
  useApplyDocExtractionItemOps,
  useCreateDocExtraction,
  useDocExtractionItemsQuery,
  useDocExtractionSummaryQuery,
} from '../../doc-intelligence';
import { WizardStepper } from '../components/WizardStepper';
import { useCatalogueImport } from '../hooks/useCatalogueImport';
import { mapDuplicateResults, useDetectDuplicates } from '../hooks/useDetectDuplicates';
import { FieldIcon } from '../icons/fieldIcons';
import {
  ArrowCircleRightIcon,
  FolderIcon,
  GitDiffIcon,
  PencilSimpleIcon,
  PlusCircleIcon,
  SealCheckIcon,
  TrashSimpleIcon,
  UploadSimpleIcon,
} from '../icons/phosphor';

type Step = 1 | 2 | 3;

/** Accepted upload types (CSV is NOT supported yet — mirrors the FOR-228 modal). */
const ACCEPT_EXTENSIONS = ['.xlsx', '.pdf', '.png', '.jpg', '.jpeg', '.webp'];
const XLSX_EXT = '.xlsx';
const MAX_XLSX_BYTES = 30 * 1024 * 1024;
const MAX_OTHER_BYTES = 10 * 1024 * 1024;

// A real distributor catalogue can be 60k+ rows. The result lives server-side;
// the wizard only ever fetches one page of rows (and PATCHes sparse row ops
// back), so neither the network nor the DOM ever carries the whole draft.
const PAGE_SIZE_OPTIONS = [25, 50, 100];
const DEFAULT_PAGE_SIZE = 50;
/** Buffered cell edits flush to the server this long after the last keystroke. */
const FLUSH_DEBOUNCE_MS = 600;

/** One rendered row: the item plus its absolute index in the stored result. */
interface WizardRow {
  index: number;
  item: CatalogueLineItem;
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

/** Shift the numeric keys of an index-keyed map after a structural row op. */
function shiftIndexKeys<T>(map: Map<number, T>, after: number, delta: number): Map<number, T> {
  const next = new Map<number, T>();
  for (const [key, value] of map) {
    if (key > after) next.set(key + delta, value);
    else next.set(key, value);
  }
  return next;
}

function shiftIndexSet(set: ReadonlySet<number>, after: number, delta: number): Set<number> {
  const next = new Set<number>();
  for (const key of set) next.add(key > after ? key + delta : key);
  return next;
}

/**
 * 3-step catalogue upload wizard (US 4.02 "Contribute to material catalogue").
 * Reuses the doc-intelligence upload + poll pipeline (`useCreateDocExtraction`,
 * `useDocExtractionSummaryQuery`, `type: 'CATALOGUE'`) — but the result stays
 * server-side: the poll carries only a row count, Steps 2/3 window the rows
 * through `useDocExtractionItemsQuery`, edits flush as sparse row ops, and
 * duplicate detection runs against the stored result by extractionId.
 *
 * Step transitions are driven by explicit onClick handlers in the header, NOT an
 * implicit `<form>` submit, to avoid the button-morph foot-gun (see
 * [[wizard-button-morph-implicit-submit]]).
 */
export default function UploadMaterialFilePage() {
  const { t } = useTranslation(['materialCatalogue']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // App-bar breadcrumb: Material Catalogue › Upload new material.
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(t('upload.title'), null, ROUTES.materialCatalogue, [
      { label: t('page.title'), to: ROUTES.materialCatalogue },
      { label: t('upload.title') },
    ]);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [extractionId, setExtractionId] = useState<string | null>(null);

  // Server-owned row count; kept in sync from the summary poll, ops results and
  // page metas. Gates the header buttons and drives pagination.
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  // Steps 2+3 can narrow the window to the duplicate rows only.
  const [dupOnly, setDupOnly] = useState(false);
  // Local view of edited rows (absolute index → row). Rendered over the fetched
  // window so typing is instant; flushed entries stay as a refetch-flicker
  // shield (the server already has their values).
  const [overlay, setOverlay] = useState<ReadonlyMap<number, CatalogueLineItem>>(new Map());
  const [persisting, setPersisting] = useState(false);
  // Cards in inline-edit mode on Step 3 (by absolute row index).
  const [editingCards, setEditingCards] = useState<ReadonlySet<number>>(new Set());

  const create = useCreateDocExtraction();
  const summaryQuery = useDocExtractionSummaryQuery(extractionId);
  const applyOps = useApplyDocExtractionItemOps(extractionId);
  const importMutation = useCatalogueImport();
  const detect = useDetectDuplicates();
  const job = summaryQuery.data;

  const { duplicateIndexes, matchesByIndex } = useMemo(
    () => mapDuplicateResults(detect.data),
    [detect.data],
  );
  const hasDuplicates = duplicateIndexes.size > 0;
  const sortedDupIndexes = useMemo(
    () => [...duplicateIndexes].sort((a, b) => a - b),
    [duplicateIndexes],
  );

  // ── Row window ──────────────────────────────────────────────────────────
  const visibleTotal = dupOnly ? sortedDupIndexes.length : total;
  const totalPages = Math.max(1, Math.ceil(visibleTotal / pageSize));
  // Deleting the last rows of the last page shrinks totalPages under `page`;
  // clamp instead of resetting so the user stays where they were.
  const safePage = Math.min(page, totalPages);
  const dupPageIndexes = useMemo(
    () => (dupOnly ? sortedDupIndexes.slice((safePage - 1) * pageSize, safePage * pageSize) : []),
    [dupOnly, sortedDupIndexes, safePage, pageSize],
  );
  const itemsParams = useMemo(
    () => (dupOnly ? { indexes: dupPageIndexes } : { page: safePage, limit: pageSize }),
    [dupOnly, dupPageIndexes, safePage, pageSize],
  );
  const itemsQuery = useDocExtractionItemsQuery<CatalogueLineItem>(
    extractionId,
    itemsParams,
    step !== 1 && (!dupOnly || dupPageIndexes.length > 0),
  );

  const rows = useMemo<WizardRow[]>(() => {
    const data = itemsQuery.data;
    if (!data || (dupOnly && dupPageIndexes.length === 0)) return [];
    return data.items.map((item, i) => {
      const index = data.indexes[i];
      return { index, item: overlay.get(index) ?? item };
    });
  }, [itemsQuery.data, overlay, dupOnly, dupPageIndexes.length]);

  // Current rendered rows by absolute index — read by the edit callbacks.
  const rowsByIndexRef = useRef<Map<number, CatalogueLineItem>>(new Map());
  rowsByIndexRef.current = new Map(rows.map((r) => [r.index, r.item]));

  // The page meta is the authoritative count after refetches (normal mode only —
  // the indexes-mode meta is scoped to the requested rows).
  const metaTotal = !dupOnly ? itemsQuery.data?.meta.total : undefined;
  useEffect(() => {
    if (metaTotal !== undefined) setTotal(metaTotal);
  }, [metaTotal]);

  // ── Upload + poll → step 2 the moment the count is known ────────────────
  const detectMutate = detect.mutate;
  useEffect(() => {
    if (step === 1 && job?.status === 'COMPLETED' && extractionId) {
      setTotal(job.resultSummary?.itemCount ?? 0);
      setPage(1);
      setStep(2);
      // Detection runs server-side over the stored result — no candidate upload.
      detectMutate({ extractionId });
    }
  }, [step, job?.status, job?.resultSummary, extractionId, detectMutate]);

  // ── File selection / upload ─────────────────────────────────────────────
  const onFileSelected = useCallback(
    (selected: File | undefined) => {
      if (!selected) return;
      setFileError(null);
      const ext = extensionOf(selected.name);
      if (!ACCEPT_EXTENSIONS.includes(ext)) {
        setFileError(t('upload.errors.unsupportedType'));
        return;
      }
      const maxBytes = ext === XLSX_EXT ? MAX_XLSX_BYTES : MAX_OTHER_BYTES;
      if (selected.size > maxBytes) {
        setFileError(t('upload.errors.tooLarge'));
        return;
      }
      setFile(selected);
    },
    [t],
  );

  const onProceed = useCallback(() => {
    if (!file) return;
    create.mutate(
      { type: 'CATALOGUE', file },
      {
        onSuccess: (created) => setExtractionId(created.id),
        onError: () => setFileError(t('upload.errors.uploadFailed')),
      },
    );
  }, [create, file, t]);

  // ── Edit flushing ───────────────────────────────────────────────────────
  // Cell edits buffer in `pendingRef` and flush as one ops batch shortly after
  // the last keystroke. Structural ops (remove/duplicate) flush the buffer
  // first so their indexes line up with the server's array.
  const pendingRef = useRef<Map<number, CatalogueLineItem>>(new Map());
  const identityTouchedRef = useRef(false);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushChainRef = useRef<Promise<void>>(Promise.resolve());
  const applyOpsMutateAsync = applyOps.mutateAsync;

  const doFlush = useCallback(async () => {
    const entries = [...pendingRef.current.entries()];
    if (entries.length === 0) return;
    pendingRef.current.clear();
    const identityTouched = identityTouchedRef.current;
    identityTouchedRef.current = false;
    try {
      const result = await applyOpsMutateAsync(
        entries.map(([index, item]) => ({
          op: 'update' as const,
          index,
          item: item as unknown as Record<string, unknown>,
        })),
      );
      setTotal(result.itemCount);
      // A name/SKU/UPC change can create or clear a collision — re-check
      // server-side now that the rows are persisted.
      if (identityTouched && extractionId) detectMutate({ extractionId });
    } catch {
      // Put the rows back so the next flush retries them (unless newer edits
      // already superseded them).
      for (const [index, item] of entries) {
        if (!pendingRef.current.has(index)) pendingRef.current.set(index, item);
      }
      identityTouchedRef.current = identityTouchedRef.current || identityTouched;
      notificationService.error(t('upload.errors.saveFailed'));
    }
  }, [applyOpsMutateAsync, detectMutate, extractionId, t]);

  const queueFlush = useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flushChainRef.current = flushChainRef.current.then(doFlush);
    }, FLUSH_DEBOUNCE_MS);
  }, [doFlush]);

  /** Flush everything buffered and wait for it — structural ops + import gate on this. */
  const flushNow = useCallback(async () => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    flushChainRef.current = flushChainRef.current.then(doFlush);
    await flushChainRef.current;
    if (pendingRef.current.size > 0) throw new Error('flush failed');
  }, [doFlush]);

  const invalidateItemWindows = useCallback(() => {
    if (!extractionId) return;
    void queryClient.invalidateQueries({
      queryKey: [...queryKeys.docExtractions.all(), extractionId, 'items'],
    });
  }, [queryClient, extractionId]);

  // ── Row mutators (absolute indexes) ─────────────────────────────────────
  const updateItem = useCallback(
    (index: number, patch: Partial<CatalogueLineItem>) => {
      const base = rowsByIndexRef.current.get(index);
      if (!base) return;
      const next = { ...base, ...patch };
      setOverlay((prev) => new Map(prev).set(index, next));
      pendingRef.current.set(index, next);
      if ('name' in patch || 'sku' in patch || 'upc' in patch) identityTouchedRef.current = true;
      queueFlush();
    },
    [queueFlush],
  );

  const runStructuralOp = useCallback(
    async (op: 'remove' | 'duplicate', index: number) => {
      if (!extractionId) return;
      try {
        await flushNow();
        const result = await applyOpsMutateAsync([{ op, index }]);
        setTotal(result.itemCount);
        const delta = op === 'remove' ? -1 : 1;
        setOverlay((prev) => {
          const next = new Map(prev);
          if (op === 'remove') next.delete(index);
          return shiftIndexKeys(next, index, delta);
        });
        setEditingCards((prev) => {
          const next = new Set(prev);
          if (op === 'remove') next.delete(index);
          return shiftIndexSet(next, index, delta);
        });
        invalidateItemWindows();
        // Row positions moved — refresh the duplicate indexes to match.
        detectMutate({ extractionId });
      } catch {
        notificationService.error(t('upload.errors.saveFailed'));
      }
    },
    [extractionId, flushNow, applyOpsMutateAsync, invalidateItemWindows, detectMutate, t],
  );

  const removeItem = useCallback(
    (index: number) => void runStructuralOp('remove', index),
    [runStructuralOp],
  );
  const duplicateItem = useCallback(
    (index: number) => void runStructuralOp('duplicate', index),
    [runStructuralOp],
  );

  const toggleCardEdit = useCallback((index: number) => {
    setEditingCards((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const toggleDupOnly = useCallback(() => {
    setDupOnly((prev) => !prev);
    setPage(1);
  }, []);

  // ── Import ──────────────────────────────────────────────────────────────
  const onAddMaterials = useCallback(async () => {
    if (!extractionId) return;
    try {
      setPersisting(true);
      // The server already holds every flushed edit; this only drains the
      // last debounce window. No whole-draft PATCH — the import reads the
      // stored result directly.
      await flushNow();
      setPersisting(false);
      const summary = await importMutation.mutateAsync(extractionId);
      // A company upload is collected into a material list named after the file —
      // land the user on it. A Super-Admin upload publishes into the shared public
      // catalogue instead (no list), so it falls back to the catalogue.
      if (summary.materialList) {
        notificationService.success(
          t('import.successWithList', {
            total: summary.total.toLocaleString(),
            list: summary.materialList.name,
          }),
        );
        navigate(ROUTES.materialCatalogueListDetail.replace(':id', summary.materialList.id));
        return;
      }
      notificationService.success(
        t('import.success', {
          total: summary.total.toLocaleString(),
          created: summary.created.toLocaleString(),
          updated: summary.updated.toLocaleString(),
          categories: summary.categoriesCreated.toLocaleString(),
        }),
      );
      navigate(ROUTES.materialCatalogue);
    } catch {
      setPersisting(false);
      notificationService.error(t('upload.errors.importFailed'));
    }
  }, [extractionId, flushNow, importMutation, t, navigate]);

  const onViewMatch = useCallback(
    (matches: MaterialDuplicateMatch[]) => {
      const first = matches[0];
      if (first) navigate(ROUTES.materialCatalogueDetail.replace(':id', first.id));
    },
    [navigate],
  );

  const cancel = () => navigate(ROUTES.materialCatalogue);

  const isUploading = create.isPending;
  const isPolling = !!job && (job.status === 'PENDING' || job.status === 'PROCESSING');
  const isProcessing = isUploading || isPolling;
  const isFailed = job?.status === 'FAILED';
  const isImporting = persisting || importMutation.isPending;

  const steps = [
    { label: t('upload.steps.upload'), icon: <UploadSimpleIcon className="size-[18px]" /> },
    { label: t('upload.steps.map'), icon: <GitDiffIcon className="size-[18px]" /> },
    { label: t('upload.steps.review'), icon: <SealCheckIcon className="size-[18px]" /> },
  ];

  const pagination = (
    <WizardPagination
      page={safePage}
      totalItems={visibleTotal}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={(size) => {
        setPageSize(size);
        setPage(1);
      }}
    />
  );

  return (
    <div className="p-8" data-testid="upload-material-page">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <FolderIcon className="size-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold text-foreground">{t('upload.title')}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={cancel} data-testid="upload-cancel">
            {t('upload.cancel')}
          </Button>
          {step === 1 && (
            <Button
              rightIcon={<PlusCircleIcon className="size-[18px]" />}
              disabled={!file || isProcessing}
              isLoading={isProcessing}
              onClick={onProceed}
              data-testid="upload-proceed"
            >
              {isProcessing
                ? isUploading
                  ? t('upload.step1.uploading')
                  : t('upload.step1.processing')
                : t('upload.step1.proceed')}
            </Button>
          )}
          {step === 2 && (
            <Button
              rightIcon={<ArrowCircleRightIcon className="size-[18px]" />}
              disabled={total === 0}
              onClick={() => setStep(3)}
              data-testid="upload-continue"
            >
              {t('upload.step2.continue')}
            </Button>
          )}
          {step === 3 && (
            <Button
              rightIcon={<PlusCircleIcon className="size-[18px]" />}
              disabled={total === 0 || isImporting}
              isLoading={isImporting}
              onClick={() => void onAddMaterials()}
              data-testid="upload-add"
            >
              {isImporting ? t('upload.step3.adding') : t('upload.step3.add')}
            </Button>
          )}
        </div>
      </div>

      {/* ── Stepper ───────────────────────────────────────────────────── */}
      <div className="mt-6">
        <WizardStepper steps={steps} current={step} />
      </div>

      <div className="mt-6 space-y-6">
        {step === 1 && (
          <UploadStep
            file={file}
            fileError={fileError}
            isProcessing={isProcessing}
            isUploading={isUploading}
            isFailed={isFailed}
            failedMessage={job?.errorMessage ?? job?.errorCode ?? ''}
            fileInputRef={fileInputRef}
            onFileSelected={onFileSelected}
          />
        )}

        {step === 2 && (
          <MapStep
            rows={rows}
            loading={itemsQuery.isLoading}
            duplicateIndexes={duplicateIndexes}
            hasDuplicates={hasDuplicates}
            dupOnly={dupOnly}
            dupCount={sortedDupIndexes.length}
            onToggleDupOnly={toggleDupOnly}
            onUpdate={updateItem}
            onRemove={removeItem}
            onDuplicate={duplicateItem}
            pagination={pagination}
          />
        )}

        {step === 3 && (
          <ReviewStep
            rows={rows}
            loading={itemsQuery.isLoading}
            duplicateIndexes={duplicateIndexes}
            matchesByIndex={matchesByIndex}
            hasDuplicates={hasDuplicates}
            dupOnly={dupOnly}
            dupCount={sortedDupIndexes.length}
            onToggleDupOnly={toggleDupOnly}
            editingCards={editingCards}
            onToggleEdit={toggleCardEdit}
            onUpdate={updateItem}
            onRemove={removeItem}
            onViewMatch={onViewMatch}
            pagination={pagination}
          />
        )}
      </div>
    </div>
  );
}

// ── Shared row pagination + duplicate banner (Steps 2 + 3) ────────────────────

function WizardPagination({
  page,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const { t } = useTranslation(['materialCatalogue']);
  if (totalItems <= 0) return null;
  return (
    <div data-testid="upload-pagination">
      <TablePagination
        page={page}
        totalItems={totalItems}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        rowsPerPageLabel={t('pagination.rowsPerPage')}
        showingLabel={({ from, to, total }) => t('pagination.showing', { from, to, total })}
        backLabel={t('pagination.back')}
        nextLabel={t('pagination.next')}
      />
    </div>
  );
}

function DuplicateBanner({
  testId,
  message,
  dupOnly,
  dupCount,
  onToggleDupOnly,
}: {
  testId: string;
  message: string;
  dupOnly: boolean;
  dupCount: number;
  onToggleDupOnly: () => void;
}) {
  const { t } = useTranslation(['materialCatalogue']);
  return (
    <div data-testid={testId}>
      <Alert variant="destructive">{message}</Alert>
      <div className="mt-2 flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="upload-dup-filter"
          onClick={onToggleDupOnly}
        >
          {dupOnly
            ? t('upload.dupFilter.showAll')
            : t('upload.dupFilter.showOnly', { count: dupCount })}
        </Button>
      </div>
    </div>
  );
}

function LoadingRows() {
  const { t } = useTranslation(['materialCatalogue']);
  return (
    <div
      className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground"
      role="status"
      data-testid="upload-rows-loading"
    >
      <SpinnerIcon className="size-4 animate-spin" aria-hidden />
      {t('upload.loadingRows')}
    </div>
  );
}

// ── Step 1: Upload File ───────────────────────────────────────────────────────

interface UploadStepProps {
  file: File | null;
  fileError: string | null;
  isProcessing: boolean;
  isUploading: boolean;
  isFailed: boolean;
  failedMessage: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileSelected: (file: File | undefined) => void;
}

const REQUIRED_COLUMN_KEYS = [
  'name',
  'category',
  'materialType',
  'uom',
  'manufacturer',
  'countryOfOrigin',
  'description',
] as const;

function UploadStep({
  file,
  fileError,
  isProcessing,
  isUploading,
  isFailed,
  failedMessage,
  fileInputRef,
  onFileSelected,
}: UploadStepProps) {
  const { t } = useTranslation(['materialCatalogue']);

  // Extracting / uploading → a centred spinner replaces the dropzone.
  if (isProcessing) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold text-foreground">{t('upload.step1.cardTitle')}</h3>
        <div
          className="mt-4 flex flex-col items-center justify-center gap-3 rounded-xl border border-border px-6 py-20 text-center"
          role="status"
          data-testid="upload-processing"
        >
          <SpinnerIcon className="size-9 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm font-semibold text-foreground">
            {isUploading ? t('upload.step1.uploading') : t('upload.step1.processingTitle')}
          </p>
          <p className="text-xs text-muted-foreground">{t('upload.step1.processingHint')}</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold text-foreground">{t('upload.step1.cardTitle')}</h3>

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
            onFileSelected(e.dataTransfer.files?.[0]);
          }}
          data-testid="upload-dropzone"
          className="mt-4 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-6 py-14 text-center transition-colors hover:border-foreground/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="mb-1 flex size-10 items-center justify-center rounded-[10px] border border-[#e8eaed] bg-[#f9f9fa] text-indigo-600 shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)]">
            <FileTextIcon className="size-5" aria-hidden />
          </span>
          <p className="text-sm text-foreground">
            {t('upload.step1.dropTitle')}{' '}
            <span className="font-semibold text-foreground underline">
              {t('upload.step1.browse')}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">{t('upload.step1.dropFormats')}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_EXTENSIONS.join(',')}
            className="sr-only"
            data-testid="upload-file-input"
            aria-label={t('upload.step1.cardTitle')}
            onChange={(e) => onFileSelected(e.target.files?.[0])}
          />
        </div>

        {file ? (
          <div
            className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#e8eaed] bg-white px-3 py-2.5"
            data-testid="upload-selected-file"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <FileTextIcon className="size-7 shrink-0 text-[#d92d20]" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {extensionOf(file.name).replace('.', '').toUpperCase()} ·{' '}
                  {t('upload.step1.complete')}
                </p>
              </div>
            </div>
            <SealCheckIcon className="size-5 shrink-0 text-success-600" aria-hidden />
          </div>
        ) : null}

        {fileError ? (
          <p className="mt-3 text-xs text-destructive" role="alert" data-testid="upload-file-error">
            {fileError}
          </p>
        ) : null}
        {isFailed ? (
          <p className="mt-3 text-xs text-destructive" role="alert" data-testid="upload-failed">
            {t('upload.errors.extractionFailed', { message: failedMessage })}
          </p>
        ) : null}
      </section>

      <Alert variant="info" icon={<InfoIcon className="h-4 w-4" />}>
        <p className="font-semibold">{t('upload.step1.requiredColumnsTitle')}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {REQUIRED_COLUMN_KEYS.map((key) => (
            <li key={key}>{t(`upload.step1.requiredColumns.${key}` as never)}</li>
          ))}
        </ul>
        <p className="mt-3">{t('upload.step1.autoMapNote')}</p>
      </Alert>
    </>
  );
}

// ── Step 2: Map and validate columns ──────────────────────────────────────────

interface MapStepProps {
  /** The rendered window — each row carries its absolute index in the result. */
  rows: WizardRow[];
  loading: boolean;
  duplicateIndexes: Set<number>;
  hasDuplicates: boolean;
  dupOnly: boolean;
  dupCount: number;
  onToggleDupOnly: () => void;
  onUpdate: (index: number, patch: Partial<CatalogueLineItem>) => void;
  onRemove: (index: number) => void;
  onDuplicate: (index: number) => void;
  pagination: React.ReactNode;
}

function MapStep({
  rows,
  loading,
  duplicateIndexes,
  hasDuplicates,
  dupOnly,
  dupCount,
  onToggleDupOnly,
  onUpdate,
  onRemove,
  onDuplicate,
  pagination,
}: MapStepProps) {
  const { t } = useTranslation(['materialCatalogue']);

  return (
    <>
      {hasDuplicates || dupOnly ? (
        <DuplicateBanner
          testId="map-duplicate-banner"
          message={t('upload.step2.duplicateBanner')}
          dupOnly={dupOnly}
          dupCount={dupCount}
          onToggleDupOnly={onToggleDupOnly}
        />
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-4 text-base font-semibold text-foreground">
          {t('upload.step2.mappingTitle')}
        </h3>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm" data-testid="map-table">
            <thead className="bg-[#f9f9fa] text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="p-3 text-left">{t('upload.step2.columns.name')}*</th>
                <th className="p-3 text-left">{t('upload.step2.columns.uom')}*</th>
                <th className="p-3 text-left">{t('upload.step2.columns.category')}*</th>
                <th className="p-3 text-left">{t('upload.step2.columns.materialType')}</th>
                <th className="p-3 text-left">{t('upload.step2.columns.manufacturer')}</th>
                <th className="p-3 text-left">{t('upload.step2.columns.upc')}</th>
                <th className="p-3 text-left">{t('upload.step2.columns.description')}</th>
                <th className="p-3 text-right">{t('upload.step2.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-muted-foreground">
                    {loading ? <LoadingRows /> : t('upload.step2.emptyRows')}
                  </td>
                </tr>
              ) : (
                rows.map(({ index, item }) => {
                  const isDuplicate = duplicateIndexes.has(index);
                  return (
                    <tr
                      key={index}
                      data-testid={`map-row-${index}`}
                      data-duplicate={isDuplicate ? 'true' : undefined}
                      className={`border-t border-border ${isDuplicate ? 'bg-destructive/[0.04]' : ''}`}
                    >
                      <td className="p-1.5">
                        <Input
                          aria-label={t('upload.step2.columns.name')}
                          value={item.name}
                          error={isDuplicate}
                          onChange={(e) => onUpdate(index, { name: e.target.value })}
                        />
                      </td>
                      <td className="p-1.5">
                        <Input
                          aria-label={t('upload.step2.columns.uom')}
                          value={item.uom ?? ''}
                          onChange={(e) => onUpdate(index, { uom: e.target.value || null })}
                        />
                      </td>
                      <td className="p-1.5">
                        <Input
                          aria-label={t('upload.step2.columns.category')}
                          value={item.mainCategory ?? ''}
                          onChange={(e) =>
                            onUpdate(index, { mainCategory: e.target.value || null })
                          }
                        />
                      </td>
                      <td className="p-1.5">
                        <Input
                          aria-label={t('upload.step2.columns.materialType')}
                          value={item.materialType ?? ''}
                          onChange={(e) =>
                            onUpdate(index, { materialType: e.target.value || null })
                          }
                        />
                      </td>
                      <td className="p-1.5">
                        <Input
                          aria-label={t('upload.step2.columns.manufacturer')}
                          // A sheet may name only one of the two; the import
                          // falls back to brand, so show whichever we have.
                          value={item.manufacturer ?? item.brand ?? ''}
                          onChange={(e) =>
                            onUpdate(index, { manufacturer: e.target.value || null })
                          }
                        />
                      </td>
                      <td className="p-1.5">
                        <Input
                          aria-label={t('upload.step2.columns.upc')}
                          value={item.upc ?? ''}
                          onChange={(e) => onUpdate(index, { upc: e.target.value || null })}
                        />
                      </td>
                      <td className="p-1.5">
                        <Input
                          aria-label={t('upload.step2.columns.description')}
                          value={item.description ?? ''}
                          onChange={(e) => onUpdate(index, { description: e.target.value || null })}
                        />
                      </td>
                      <td className="p-1.5">
                        <div className="flex items-center justify-end gap-1">
                          {isDuplicate ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              iconOnly
                              aria-label={t('upload.step2.actions.duplicate')}
                              data-testid={`map-duplicate-row-${index}`}
                              onClick={() => onDuplicate(index)}
                            >
                              <CopyIcon className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            iconOnly
                            aria-label={t('upload.step2.actions.delete')}
                            data-testid={`map-delete-row-${index}`}
                            onClick={() => onRemove(index)}
                          >
                            <TrashSimpleIcon className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4">{pagination}</div>
      </section>
    </>
  );
}

// ── Step 3: Review & import ───────────────────────────────────────────────────

interface ReviewStepProps {
  /** The rendered window — each row carries its absolute index in the result. */
  rows: WizardRow[];
  loading: boolean;
  duplicateIndexes: Set<number>;
  matchesByIndex: Map<number, MaterialDuplicateMatch[]>;
  hasDuplicates: boolean;
  dupOnly: boolean;
  dupCount: number;
  onToggleDupOnly: () => void;
  editingCards: ReadonlySet<number>;
  onToggleEdit: (index: number) => void;
  onUpdate: (index: number, patch: Partial<CatalogueLineItem>) => void;
  onRemove: (index: number) => void;
  onViewMatch: (matches: MaterialDuplicateMatch[]) => void;
  pagination: React.ReactNode;
}

function ReviewStep({
  rows,
  loading,
  duplicateIndexes,
  matchesByIndex,
  hasDuplicates,
  dupOnly,
  dupCount,
  onToggleDupOnly,
  editingCards,
  onToggleEdit,
  onUpdate,
  onRemove,
  onViewMatch,
  pagination,
}: ReviewStepProps) {
  const { t } = useTranslation(['materialCatalogue']);

  return (
    <>
      {hasDuplicates || dupOnly ? (
        <DuplicateBanner
          testId="review-duplicate-banner"
          message={t('upload.step3.duplicateBanner')}
          dupOnly={dupOnly}
          dupCount={dupCount}
          onToggleDupOnly={onToggleDupOnly}
        />
      ) : null}

      <div className="space-y-4" data-testid="review-list">
        {rows.length === 0 && loading ? <LoadingRows /> : null}
        {rows.map(({ index, item }) => {
          const matches = matchesByIndex.get(index);
          const isDuplicate = duplicateIndexes.has(index);
          const isEditing = editingCards.has(index);
          const firstMatch = matches?.[0];

          return (
            <article
              key={index}
              data-testid={`review-card-${index}`}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex items-start justify-between gap-4">
                {isEditing ? (
                  <Input
                    aria-label={t('upload.step2.columns.name')}
                    value={item.name}
                    onChange={(e) => onUpdate(index, { name: e.target.value })}
                    className="max-w-sm"
                    data-testid={`review-name-input-${index}`}
                  />
                ) : (
                  <h3
                    className="min-w-0 truncate text-base font-semibold text-foreground"
                    title={item.name}
                  >
                    {item.name}
                  </h3>
                )}
                <div className="flex flex-shrink-0 items-center gap-2">
                  {firstMatch ? (
                    <Button
                      variant="outline"
                      size="sm"
                      iconOnly
                      aria-label={t('upload.step3.view')}
                      data-testid={`review-view-${index}`}
                      onClick={() => matches && onViewMatch(matches)}
                    >
                      <EyeIcon className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<PencilSimpleIcon className="size-3.5" />}
                    data-testid={`review-edit-${index}`}
                    onClick={() => onToggleEdit(index)}
                  >
                    {isEditing ? t('upload.step3.done') : t('upload.step3.edit')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    iconOnly
                    aria-label={t('upload.step3.delete')}
                    data-testid={`review-delete-${index}`}
                    onClick={() => onRemove(index)}
                  >
                    <TrashSimpleIcon className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-3 lg:grid-cols-5">
                <ReviewField
                  label={t('upload.step3.meta.category')}
                  field="category"
                  value={item.mainCategory}
                  editing={isEditing}
                  onChange={(v) => onUpdate(index, { mainCategory: v || null })}
                />
                <ReviewField
                  label={t('upload.step3.meta.materialType')}
                  field="materialType"
                  value={item.materialType}
                  editing={isEditing}
                  onChange={(v) => onUpdate(index, { materialType: v || null })}
                />
                <ReviewField
                  label={t('upload.step3.meta.manufacturer')}
                  field="manufacturer"
                  value={item.manufacturer ?? item.brand}
                  editing={isEditing}
                  onChange={(v) => onUpdate(index, { manufacturer: v || null })}
                />
                <ReviewField
                  label={t('upload.step3.meta.uom')}
                  field="uom"
                  value={item.uom}
                  editing={isEditing}
                  onChange={(v) => onUpdate(index, { uom: v || null })}
                />
                <ReviewField
                  label={t('upload.step3.meta.upc')}
                  field="upc"
                  value={item.upc}
                  editing={isEditing}
                  onChange={(v) => onUpdate(index, { upc: v || null })}
                />
                <ReviewField
                  label={t('upload.step3.meta.countryOfOrigin')}
                  field="countryOfOrigin"
                  value={item.countryOfOrigin}
                  editing={isEditing}
                  onChange={(v) => onUpdate(index, { countryOfOrigin: v || null })}
                />
                <ReviewField
                  label={t('upload.step3.meta.pricePerUnit')}
                  field="pricePerUnit"
                  value={item.pricePerUnit === null ? null : String(item.pricePerUnit)}
                  editing={isEditing}
                  // NaN would silently drop the row's price on import, so an
                  // unparseable edit clears it instead (see [[rhf-valueasnumber-nan-silent-submit]]).
                  onChange={(v) => {
                    const parsed = Number(v);
                    onUpdate(index, {
                      pricePerUnit: v.trim() === '' || Number.isNaN(parsed) ? null : parsed,
                    });
                  }}
                />
                <ReviewField
                  label={t('upload.step3.meta.costCode')}
                  field="costCode"
                  value={item.costCode}
                  editing={isEditing}
                  onChange={(v) => onUpdate(index, { costCode: v || null })}
                />
                <ReviewField
                  label={t('upload.step3.meta.taxCode')}
                  field="taxCode"
                  value={item.taxCode}
                  editing={isEditing}
                  onChange={(v) => onUpdate(index, { taxCode: v || null })}
                />
              </div>

              {isDuplicate && firstMatch ? (
                <div
                  className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3"
                  data-testid={`review-duplicate-strip-${index}`}
                >
                  <p className="flex items-start gap-2 text-sm text-warning">
                    <WarningIcon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
                    <span>
                      {t('upload.step3.duplicateStrip', {
                        code: firstMatch.code,
                        name: firstMatch.name,
                      })}
                    </span>
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0"
                    data-testid={`review-view-match-${index}`}
                    onClick={() => matches && onViewMatch(matches)}
                  >
                    {t('upload.step3.viewMatch', { code: firstMatch.code })}
                  </Button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {pagination}
    </>
  );
}

function ReviewField({
  label,
  field,
  value,
  editing,
  onChange,
}: {
  label: string;
  field: string;
  value: string | null | undefined;
  editing: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-foreground">{label}</p>
      {editing ? (
        <Input
          aria-label={label}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1"
        />
      ) : (
        <p
          className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground"
          title={value ?? ''}
        >
          <span className="shrink-0 text-gray-400">
            <FieldIcon field={field} className="size-3.5" />
          </span>
          {value && value.length > 0 ? value : '—'}
        </p>
      )}
    </div>
  );
}
