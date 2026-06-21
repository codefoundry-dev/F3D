import { updateDocExtraction, type MaterialDuplicateMatch } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  type CatalogueExtractionResult,
  type CatalogueLineItem,
  isCatalogueExtractionResult,
} from '@forethread/shared-types/client';
import { Alert, Button, Input, notificationService, useDebounce } from '@forethread/ui-components';
import CopyIcon from '@forethread/ui-components/assets/icons/copy.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import FileTextIcon from '@forethread/ui-components/assets/icons/file-text.svg?react';
import WarningIcon from '@forethread/ui-components/assets/icons/info-in-triangle.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import SpinnerIcon from '@forethread/ui-components/assets/icons/spinner.svg?react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { useCreateDocExtraction, useDocExtractionQuery } from '../../doc-intelligence';
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

const EMPTY_RESULT: CatalogueExtractionResult = { sourceName: null, items: [], notes: null };

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

/**
 * 3-step catalogue upload wizard (US 4.02 "Contribute to material catalogue").
 * Reuses the doc-intelligence upload + poll pipeline (`useCreateDocExtraction`,
 * `useDocExtractionQuery`, `type: 'CATALOGUE'`) — the same flow the FOR-228
 * `CatalogueImportModal` runs — but as a full page with column mapping and
 * duplicate detection.
 *
 * Step transitions are driven by explicit onClick handlers in the header, NOT an
 * implicit `<form>` submit, to avoid the button-morph foot-gun (see
 * [[wizard-button-morph-implicit-submit]]).
 */
export default function UploadMaterialFilePage() {
  const { t } = useTranslation(['materialCatalogue']);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [extractionId, setExtractionId] = useState<string | null>(null);

  // Canonical edited draft; edits update a single index immutably (no whole-array
  // deep clone per keystroke). `dirty` gates whether we PATCH the result back.
  const [draft, setDraft] = useState<CatalogueExtractionResult | null>(null);
  const [dirty, setDirty] = useState(false);
  const [persisting, setPersisting] = useState(false);
  // Cards in inline-edit mode on Step 3 (by row index).
  const [editingCards, setEditingCards] = useState<ReadonlySet<number>>(new Set());

  const create = useCreateDocExtraction();
  const query = useDocExtractionQuery(extractionId);
  const importMutation = useCatalogueImport();
  const detect = useDetectDuplicates();
  const job = query.data;

  const items = useMemo(() => draft?.items ?? [], [draft]);

  // ── Upload + poll → seed the draft, advance to Step 2 ───────────────────
  useEffect(() => {
    if (job?.status === 'COMPLETED' && job.editedResult && draft === null) {
      const result = isCatalogueExtractionResult(job.editedResult)
        ? job.editedResult
        : EMPTY_RESULT;
      setDraft(result);
      setStep(2);
    }
  }, [job?.status, job?.editedResult, draft]);

  // ── Duplicate detection (debounced) ─────────────────────────────────────
  const candidateSignature = useMemo(
    () => items.map((i) => `${i.name}|${i.sku ?? ''}|${i.upc ?? ''}`).join('\n'),
    [items],
  );
  const debouncedSignature = useDebounce(candidateSignature, 400);
  const detectMutate = detect.mutate;

  useEffect(() => {
    if (step === 1 || items.length === 0) return;
    detectMutate(items.map((i) => ({ name: i.name, sku: i.sku, upc: i.upc })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSignature, step, detectMutate]);

  const { duplicateIndexes, matchesByIndex } = useMemo(
    () => mapDuplicateResults(detect.data),
    [detect.data],
  );
  const hasDuplicates = duplicateIndexes.size > 0;

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

  // ── Draft mutators ──────────────────────────────────────────────────────
  const updateItem = useCallback((index: number, patch: Partial<CatalogueLineItem>) => {
    setDraft((prev) =>
      prev
        ? { ...prev, items: prev.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) }
        : prev,
    );
    setDirty(true);
  }, []);

  const removeItem = useCallback((index: number) => {
    setDraft((prev) =>
      prev ? { ...prev, items: prev.items.filter((_, i) => i !== index) } : prev,
    );
    setDirty(true);
  }, []);

  const duplicateItem = useCallback((index: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const clone = { ...prev.items[index] };
      const next = [...prev.items];
      next.splice(index + 1, 0, clone);
      return { ...prev, items: next };
    });
    setDirty(true);
  }, []);

  const toggleCardEdit = useCallback((index: number) => {
    setEditingCards((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  // ── Import ──────────────────────────────────────────────────────────────
  const onAddMaterials = useCallback(async () => {
    if (!extractionId || !draft) return;
    try {
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
      navigate(ROUTES.materialCatalogue);
    } catch {
      setPersisting(false);
      notificationService.error(t('upload.errors.importFailed'));
    }
  }, [extractionId, draft, dirty, importMutation, t, navigate]);

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
              disabled={items.length === 0}
              onClick={() => setStep(3)}
              data-testid="upload-continue"
            >
              {t('upload.step2.continue')}
            </Button>
          )}
          {step === 3 && (
            <Button
              rightIcon={<PlusCircleIcon className="size-[18px]" />}
              disabled={items.length === 0 || isImporting}
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
            items={items}
            duplicateIndexes={duplicateIndexes}
            hasDuplicates={hasDuplicates}
            onUpdate={updateItem}
            onRemove={removeItem}
            onDuplicate={duplicateItem}
          />
        )}

        {step === 3 && (
          <ReviewStep
            items={items}
            duplicateIndexes={duplicateIndexes}
            matchesByIndex={matchesByIndex}
            hasDuplicates={hasDuplicates}
            editingCards={editingCards}
            onToggleEdit={toggleCardEdit}
            onUpdate={updateItem}
            onRemove={removeItem}
            onViewMatch={onViewMatch}
          />
        )}
      </div>
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
  items: CatalogueLineItem[];
  duplicateIndexes: Set<number>;
  hasDuplicates: boolean;
  onUpdate: (index: number, patch: Partial<CatalogueLineItem>) => void;
  onRemove: (index: number) => void;
  onDuplicate: (index: number) => void;
}

function MapStep({
  items,
  duplicateIndexes,
  hasDuplicates,
  onUpdate,
  onRemove,
  onDuplicate,
}: MapStepProps) {
  const { t } = useTranslation(['materialCatalogue']);

  return (
    <>
      {hasDuplicates ? (
        <div data-testid="map-duplicate-banner">
          <Alert variant="destructive">{t('upload.step2.duplicateBanner')}</Alert>
        </div>
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
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-muted-foreground">
                    {t('upload.step2.emptyRows')}
                  </td>
                </tr>
              ) : (
                items.map((item, index) => {
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
                      {/* Material type has no backing field on CatalogueLineItem,
                          so it is read-only here ("—") until the extraction schema
                          carries it. */}
                      <td className="p-3 text-muted-foreground">—</td>
                      <td className="p-1.5">
                        <Input
                          aria-label={t('upload.step2.columns.manufacturer')}
                          value={item.brand ?? ''}
                          onChange={(e) => onUpdate(index, { brand: e.target.value || null })}
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
      </section>
    </>
  );
}

// ── Step 3: Review & import ───────────────────────────────────────────────────

interface ReviewStepProps {
  items: CatalogueLineItem[];
  duplicateIndexes: Set<number>;
  matchesByIndex: Map<number, MaterialDuplicateMatch[]>;
  hasDuplicates: boolean;
  editingCards: ReadonlySet<number>;
  onToggleEdit: (index: number) => void;
  onUpdate: (index: number, patch: Partial<CatalogueLineItem>) => void;
  onRemove: (index: number) => void;
  onViewMatch: (matches: MaterialDuplicateMatch[]) => void;
}

function ReviewStep({
  items,
  duplicateIndexes,
  matchesByIndex,
  hasDuplicates,
  editingCards,
  onToggleEdit,
  onUpdate,
  onRemove,
  onViewMatch,
}: ReviewStepProps) {
  const { t } = useTranslation(['materialCatalogue']);

  return (
    <>
      {hasDuplicates ? (
        <div data-testid="review-duplicate-banner">
          <Alert variant="destructive">{t('upload.step3.duplicateBanner')}</Alert>
        </div>
      ) : null}

      <div className="space-y-4" data-testid="review-list">
        {items.map((item, index) => {
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
                {/* Material type is not on CatalogueLineItem (read-only). */}
                <ReviewField
                  label={t('upload.step3.meta.materialType')}
                  field="materialType"
                  value={null}
                  editing={false}
                  onChange={() => {}}
                />
                <ReviewField
                  label={t('upload.step3.meta.manufacturer')}
                  field="manufacturer"
                  value={item.brand}
                  editing={isEditing}
                  onChange={(v) => onUpdate(index, { brand: v || null })}
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
