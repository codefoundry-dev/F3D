import { confirmDocExtraction, listSpreadsheetSheets } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Stepper } from '@forethread/po-shared';
import { isBomExtractionResult, type BomExtractionResult } from '@forethread/shared-types/client';
import {
  Button,
  Checkbox,
  Input,
  Modal,
  RadioButton,
  Spinner,
  notificationService,
} from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import SearchIcon from '@forethread/ui-components/assets/icons/search.svg?react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import {
  useCreateDocExtraction,
  useDocExtractionQuery,
} from '@/features/doc-intelligence/hooks/useDocExtraction';
import { useProjects } from '@/features/projects/services/projects.service';

import {
  firstNonEmpty,
  realRows,
  rowsFromExtraction,
  rowsToBomResult,
  rowsToCreateItems,
  unmatchedCount,
  type BomDraftRow,
} from '../components/create/bom-draft';
import { BomReviewStep } from '../components/create/BomReviewStep';
import { useCreateBom } from '../hooks/useBoms';

const ACCEPTED_EXTENSIONS = '.xlsx,.csv,.pdf';

type WizardStep = 1 | 2 | 3;
type UploadPhase = 'idle' | 'processing' | 'failed';

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground leading-[22px]">{title}</h2>
      <p className="text-[13px] text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  );
}

/** Dropzone matching the US 5.01 upload card (title + formats hint, click or drop). */
function BomDropzone({ onFile, t }: { onFile: (file: File) => void; t: (key: string) => string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <button
      type="button"
      data-testid="bom-dropzone"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={`w-full h-40 rounded-xl border border-dashed flex flex-col items-center justify-center gap-1.5 transition-colors ${
        dragOver ? 'border-primary bg-primary/5' : 'border-border bg-[#FCFCFC] hover:bg-muted/30'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
      <span className="text-base font-semibold text-foreground">{t('create.dropzoneTitle')}</span>
      <span className="text-[13px] text-muted-foreground">{t('create.dropzoneHint')}</span>
    </button>
  );
}

export default function CreateBomPage() {
  const { id: routeProjectId } = useParams<{ id: string }>();
  const { t: tRaw } = useTranslation('boms');
  const t = tRaw as (key: string, options?: Record<string, unknown>) => string;
  const navigate = useNavigate();

  const [step, setStep] = useState<WizardStep>(1);
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [file, setFile] = useState<File | null>(null);
  // Worksheet names of the uploaded spreadsheet, and the subset the user wants
  // extracted. `sheets` is only populated for multi-sheet workbooks; a single
  // sheet (or a CSV/PDF) needs no picker and extracts everything.
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [rows, setRows] = useState<BomDraftRow[]>([]);
  const [baseResult, setBaseResult] = useState<BomExtractionResult | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState(routeProjectId ?? '');
  const [projectSearch, setProjectSearch] = useState('');
  const [createdProjectName, setCreatedProjectName] = useState<string | null>(null);

  const createExtraction = useCreateDocExtraction();
  const extractionQuery = useDocExtractionQuery(phase === 'idle' ? null : extractionId);
  const createBomMutation = useCreateBom();
  const { data: projectsData } = useProjects({ limit: 100 });

  const targetProjectId = firstNonEmpty(selectedProjectId, routeProjectId);
  const projectBomTabUrl = `${ROUTES.projectDetail.replace(':id', targetProjectId)}?tab=bom`;
  const exitToProject = useCallback(
    () => navigate(`${ROUTES.projectDetail.replace(':id', routeProjectId ?? '')}?tab=bom`),
    [navigate, routeProjectId],
  );

  // Drive the upload phase from the extraction poll.
  const extractionStatus = extractionQuery.data?.status;
  useEffect(() => {
    if (phase !== 'processing' || !extractionQuery.data) return;
    if (extractionStatus === 'COMPLETED' || extractionStatus === 'CONFIRMED') {
      const result = extractionQuery.data.editedResult;
      setRows(rowsFromExtraction(result));
      setBaseResult(isBomExtractionResult(result) ? result : null);
      setPhase('idle');
      setStep(2);
    } else if (extractionStatus === 'FAILED') {
      setPhase('failed');
    }
  }, [phase, extractionStatus, extractionQuery.data]);

  const handleSelectFile = useCallback((target: File) => {
    setFile(target);
    setSheets([]);
    setSelectedSheets([]);
    // Pre-flight only for spreadsheets; CSV/PDF have no sheets to choose between.
    if (/\.xlsx$/iu.test(target.name)) {
      void listSpreadsheetSheets(target)
        .then((names) => {
          // Only a multi-sheet workbook needs the picker; default to all selected.
          if (names.length > 1) {
            setSheets(names);
            setSelectedSheets(names);
          }
        })
        .catch(() => undefined); // non-fatal: fall back to extracting every sheet
    }
  }, []);

  const clearFile = useCallback(() => {
    setFile(null);
    setSheets([]);
    setSelectedSheets([]);
  }, []);

  const toggleSheet = (name: string) => {
    setSelectedSheets((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
  };

  const startExtraction = useCallback(
    (target: File) => {
      createExtraction.mutate(
        {
          type: 'BOM',
          file: target,
          // Constrain to the picked sheets only when the user had a choice to make.
          sheetNames: sheets.length > 1 ? selectedSheets : undefined,
        },
        {
          onSuccess: (job) => {
            setExtractionId(job.id);
            setPhase('processing');
          },
          onError: () => notificationService.error(t('create.uploadError')),
        },
      );
    },
    [createExtraction, t, sheets, selectedSheets],
  );

  const handleCreateBom = () => {
    if (!selectedProjectId) return;
    createBomMutation.mutate(
      {
        projectId: selectedProjectId,
        extractionId: extractionId ?? undefined,
        items: rowsToCreateItems(rows),
      },
      {
        onSuccess: () => {
          const project = (projectsData?.items ?? []).find((p) => p.id === selectedProjectId);
          setCreatedProjectName(project?.name ?? '');
          // Best-effort: lock the source extraction with the reviewed result so
          // "RFQ from BOM" sees the same confirmed line items.
          if (extractionId) {
            void confirmDocExtraction(
              extractionId,
              rowsToBomResult(rows, baseResult) as unknown as Record<string, unknown>,
            ).catch(() => undefined);
          }
        },
        onError: () => notificationService.error(t('create.createError')),
      },
    );
  };

  const stepLabels = [t('create.stepLabel1'), t('create.stepLabel2'), t('create.stepLabel3')];
  const unmatched = unmatchedCount(rows);
  const hasRows = realRows(rows).length > 0;

  const filteredProjects = useMemo(() => {
    const items = projectsData?.items ?? [];
    const term = projectSearch.trim().toLowerCase();
    if (!term) return items;
    return items.filter((p) => p.name.toLowerCase().includes(term));
  }, [projectsData, projectSearch]);

  // ── Step 1 content variants ────────────────────────────────────────────────

  const processingCard = (
    <div className="max-w-[1044px] mx-auto w-full bg-card border border-border rounded-lg min-h-[299px] flex flex-col items-center justify-center gap-6 py-12">
      <Spinner size="lg" />
      <div className="text-center">
        <p className="text-lg font-semibold text-foreground">{t('create.processingTitle')}</p>
        <p className="text-[13px] text-muted-foreground mt-1.5">{t('create.processingSubtitle')}</p>
      </div>
    </div>
  );

  const failedCard = (
    <div className="max-w-[1044px] mx-auto w-full bg-card border border-border rounded-lg flex flex-col items-center gap-10 px-8 py-8">
      <div className="flex flex-col items-center gap-2 w-full">
        <div className="w-12 h-12 rounded-full bg-foreground flex items-center justify-center">
          <InfoIcon className="w-6 h-6 text-background" />
        </div>
        <h2 className="text-2xl text-foreground text-center mt-2">{t('create.failedTitle')}</h2>
        <p className="text-base text-foreground/80 text-center">{t('create.failedSubtitle')}</p>
      </div>
      <div className="flex flex-col items-center gap-3 w-full max-w-[627px]">
        <Button
          className="w-full h-[52px]"
          isLoading={createExtraction.isPending}
          onClick={() => file && startExtraction(file)}
          data-testid="bom-try-again"
        >
          {t('create.tryAgain')}
        </Button>
        <Button
          variant="outline"
          className="w-full h-12"
          onClick={() => {
            setPhase('idle');
            setExtractionId(null);
          }}
        >
          {t('create.cancel')}
        </Button>
      </div>
    </div>
  );

  const uploadStep = (
    <div className="space-y-6">
      <StepHeading title={t('create.step1Title')} subtitle={t('create.step1Subtitle')} />

      <div className="bg-card border border-border rounded-lg p-6 space-y-5">
        <h3 className="text-lg font-semibold text-foreground">{t('create.uploadCardTitle')}</h3>
        <BomDropzone onFile={handleSelectFile} t={t} />
      </div>

      {file && (
        <div className="bg-card border border-border rounded-lg px-4 py-4 flex items-center justify-between gap-4">
          <span className="text-sm text-foreground truncate" data-testid="bom-file-name">
            {file.name}
          </span>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              aria-label="Preview file"
              onClick={() => window.open(URL.createObjectURL(file), '_blank', 'noopener')}
              className="text-muted-foreground hover:text-foreground"
            >
              <EyeIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              aria-label="Remove file"
              onClick={clearFile}
              className="text-muted-foreground hover:text-destructive"
              data-testid="bom-remove-file"
            >
              <DeleteIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {sheets.length > 1 && (
        <div
          className="bg-card border border-border rounded-lg p-5 space-y-3"
          data-testid="bom-sheet-picker"
        >
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t('create.sheetSelectTitle')}
            </h3>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {t('create.sheetSelectHint')}
            </p>
          </div>
          <div className="space-y-2.5">
            {sheets.map((name) => (
              <Checkbox
                key={name}
                checked={selectedSheets.includes(name)}
                onChange={() => toggleSheet(name)}
                label={name}
              />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-[#0634BA]/[0.06] p-4 flex items-start gap-2.5">
        <EnvelopeIcon className="w-[18px] h-[18px] shrink-0 mt-0.5 text-[#0634BA]" />
        <div className="text-sm text-[#0634BA] leading-relaxed">
          <p>{t('create.requiredColumnsTitle')}</p>
          <ul className="list-disc pl-5 my-1">
            {(t('create.requiredColumnsList', { returnObjects: true }) as unknown as string[]).map(
              (column) => (
                <li key={column}>{column}</li>
              ),
            )}
          </ul>
          <p>{t('create.requiredColumnsNote')}</p>
        </div>
      </div>
    </div>
  );

  // ── Step 3 ────────────────────────────────────────────────────────────────

  const assignStep = (
    <div className="space-y-3">
      <StepHeading title={t('create.step3Title')} subtitle={t('create.step3Subtitle')} />

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={projectSearch}
          onChange={(e) => setProjectSearch(e.target.value)}
          placeholder={t('create.searchProjects')}
          className="pl-9"
          data-testid="bom-project-search"
        />
      </div>

      <div className="space-y-2">
        {filteredProjects.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">{t('create.noProjects')}</p>
        )}
        {filteredProjects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => setSelectedProjectId(project.id)}
            data-testid={`bom-project-${project.id}`}
            className={`w-full bg-card border rounded-lg px-4 py-3 flex items-center gap-4 text-left transition-colors ${
              selectedProjectId === project.id
                ? 'border-foreground'
                : 'border-border hover:border-foreground/30'
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{project.name}</p>
              {project.description && (
                <p className="text-[13px] text-muted-foreground truncate mt-1">
                  {project.description}
                </p>
              )}
            </div>
            <RadioButton
              checked={selectedProjectId === project.id}
              onChange={() => setSelectedProjectId(project.id)}
            />
          </button>
        ))}
      </div>

      <div className="pt-3">
        <Button
          variant="outline"
          className="h-12"
          onClick={() => window.open(ROUTES.projectsNew, '_blank', 'noopener')}
        >
          {t('create.createNewProject')}
        </Button>
      </div>
    </div>
  );

  // ── Footer ────────────────────────────────────────────────────────────────

  const showFooter = phase === 'idle';
  const footer = (
    <div className="flex items-center justify-between mt-10">
      <Button variant="outline" size="lg" className="h-12 text-sm" onClick={exitToProject}>
        {t('create.cancel')}
      </Button>

      {step === 1 && (
        <Button
          size="lg"
          className="h-12 text-sm"
          rightIcon={<span>&rarr;</span>}
          disabled={!file || (sheets.length > 1 && selectedSheets.length === 0)}
          isLoading={createExtraction.isPending}
          onClick={() => file && startExtraction(file)}
          data-testid="bom-proceed"
        >
          {t('create.proceed')}
        </Button>
      )}

      {step === 2 && (
        <Button
          size="lg"
          className="h-12 text-sm disabled:bg-[#9C9C9C] disabled:opacity-100"
          disabled={unmatched > 0 || !hasRows}
          onClick={() => setStep(3)}
          data-testid="bom-continue"
        >
          {unmatched > 0 ? t('create.matchItemsFirst') : t('create.continue')}
        </Button>
      )}

      {step === 3 && (
        <Button
          size="lg"
          className="h-12 text-sm"
          disabled={!selectedProjectId}
          isLoading={createBomMutation.isPending}
          onClick={handleCreateBom}
          data-testid="bom-create"
        >
          {t('create.createBom')}
        </Button>
      )}
    </div>
  );

  return (
    <div className="p-4 sm:px-10 flex flex-col flex-1 min-h-full bg-secondary">
      <Stepper step={step} labels={stepLabels} />

      <div className="flex flex-col flex-1 pt-8 max-w-[1288px] w-full mx-auto">
        {step === 1 && phase === 'processing' && processingCard}
        {step === 1 && phase === 'failed' && failedCard}
        {step === 1 && phase === 'idle' && uploadStep}
        {step === 2 && (
          <div className="space-y-6">
            <StepHeading title={t('create.step2Title')} subtitle={t('create.step2Subtitle')} />
            <BomReviewStep rows={rows} onRowsChange={setRows} />
          </div>
        )}
        {step === 3 && assignStep}

        {showFooter && footer}
      </div>

      {createdProjectName !== null && (
        <Modal onClose={exitToProject} maxWidth="max-w-[560px]">
          <div className="p-8 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-foreground flex items-center justify-center">
              <CheckCircleIcon className="w-6 h-6 text-background" />
            </div>
            <h2 className="text-2xl text-foreground mt-2">{t('create.successTitle')}</h2>
            <p className="text-base text-foreground/80">
              {t('create.successDescription', { project: createdProjectName })}
            </p>
            <div className="flex flex-col gap-2 w-full mt-6">
              <Button
                className="w-full h-12"
                onClick={() => navigate(projectBomTabUrl)}
                data-testid="bom-success-view"
              >
                {t('create.viewBom')}
              </Button>
              <Button
                variant="outline"
                className="w-full h-12"
                onClick={() => navigate(ROUTES.projectDetail.replace(':id', targetProjectId))}
              >
                {t('create.backToProject')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
