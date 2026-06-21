import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { StatusErrorModal } from '@forethread/ui-components';
import RequestIcon from '@forethread/ui-components/assets/icons/request.svg?react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { PrimaryButton, SecondaryButton } from '../components/MobileButtons';
import { MobileHeader } from '../components/MobileHeader';
import { MobileShell } from '../components/MobileShell';
import { type NewMaterialDraft } from '../components/NewMaterialModal';
import {
  StepMaterialDetails,
  type DeliveryLocationOption,
} from '../components/StepMaterialDetails';
import { StepProgress } from '../components/StepProgress';
import { StepReview } from '../components/StepReview';
import { StepSelectMaterials } from '../components/StepSelectMaterials';
import {
  useCreateMaterialRequest,
  useMrProjectDetail,
} from '../services/material-requests.service';
import {
  buildCreateInput,
  nextLineKey,
  validateDetails,
  validateSelection,
  hasDetailsErrors,
  type MrDetailsErrors,
  type MrWizardLine,
} from '../wizard/wizard-types';

type WizardStep = 0 | 1 | 2;

/**
 * Host for the 3-step "Raise a Material Request" wizard (Figma 2002:176),
 * rebuilt on the desktop design system so it reads like the material-catalogue
 * create wizard: a page header with the step navigation top-right, a horizontal
 * stepper, and the active step inside a DS card. Owns the wizard line state and
 * renders the per-step component.
 *
 * The navigation uses separate button nodes per step (never a native form
 * submit) to avoid the step→final button-morph submit bug documented in prior
 * sessions.
 */
export default function RequestMaterialsPage() {
  const { t } = useTranslation('materialRequests');
  const navigate = useNavigate();
  const { projectId = '' } = useParams<{ projectId: string }>();

  const projectQuery = useMrProjectDetail(projectId);
  const createMutation = useCreateMaterialRequest();

  const [step, setStep] = useState<WizardStep>(0);
  const [lines, setLines] = useState<MrWizardLine[]>([]);
  const [detailErrors, setDetailErrors] = useState<MrDetailsErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const project = projectQuery.data;
  const jobCode = project?.name ?? projectId;
  const projectName = project?.name ?? '';

  const locationOptions: DeliveryLocationOption[] = useMemo(
    () =>
      (project?.locations ?? [])
        .filter((l) => l.type === 'DELIVERY')
        .map((l) => ({ id: l.id, label: l.label ? `${l.label} — ${l.address}` : l.address })),
    [project?.locations],
  );

  // Default each line's delivery location to the project's default delivery
  // location once the project loads, so the foreman rarely has to set it.
  const defaultLocationId = useMemo(
    () =>
      (project?.locations ?? []).find((l) => l.type === 'DELIVERY' && l.isDefault)?.id ??
      (project?.locations ?? []).find((l) => l.type === 'DELIVERY')?.id,
    [project?.locations],
  );

  const toggleLine = useCallback(
    (line: MrWizardLine) => {
      setLines((prev) => [...prev, { ...line, deliveryLocationId: defaultLocationId }]);
    },
    [defaultLocationId],
  );

  const addManual = useCallback(
    (draft: NewMaterialDraft) => {
      setLines((prev) => [
        ...prev,
        {
          key: nextLineKey(),
          source: 'MANUAL',
          materialName: draft.materialName,
          description: draft.description,
          unit: draft.unit,
          quantity: draft.quantity,
          priority: 'STANDARD',
          deliveryLocationId: defaultLocationId,
        },
      ]);
    },
    [defaultLocationId],
  );

  const removeLine = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const patchLine = useCallback((key: string, patch: Partial<MrWizardLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    // Clear that line's errors as the foreman edits.
    setDetailErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const goBack = () => {
    if (step === 0) {
      navigate(ROUTES.materialRequestJobs);
      return;
    }
    setStep((s) => (s - 1) as WizardStep);
  };

  const handleContinueFromSelect = () => {
    if (!validateSelection(lines)) return;
    setStep(1);
  };

  const handleContinueFromDetails = () => {
    const errors = validateDetails(lines);
    setDetailErrors(errors);
    if (hasDetailsErrors(errors)) return;
    setStep(2);
  };

  const handleSubmit = () => {
    if (lines.length === 0) return;
    const input = buildCreateInput({ projectId, lines }, { submit: true });
    createMutation.mutate(input, {
      onSuccess: (mr) => {
        navigate(ROUTES.materialRequestConfirmation.replace(':id', mr.id), {
          state: { mr },
        });
      },
      onError: () => setSubmitError(t('review.submitFailed')),
    });
  };

  const selectedCount = lines.length;

  const stepLabels = [
    t('requestMaterials.steps.select'),
    t('requestMaterials.steps.details'),
    t('requestMaterials.steps.review'),
  ];

  const headerTitle =
    step === 0
      ? t('requestMaterials.title')
      : step === 1
        ? t('materialDetails.title')
        : t('review.title');

  // App-bar breadcrumb / page title reflects the current wizard step.
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    const overviewPath = ROUTES.materialRequestJobOverview.replace(':projectId', projectId);
    setPageTitle(headerTitle, null, overviewPath, [
      { label: t('jobOverview.title'), to: overviewPath },
      { label: headerTitle },
    ]);
    return () => setPageTitle(null);
  }, [setPageTitle, headerTitle, projectId, t]);

  return (
    <MobileShell
      header={
        <MobileHeader
          title={headerTitle}
          onBack={goBack}
          icon={<RequestIcon />}
          trailing={renderActions()}
        />
      }
    >
      <StepProgress steps={stepLabels} current={step + 1} />

      <div className="rounded-xl border border-border bg-card">
        {step === 0 && (
          <StepSelectMaterials
            projectId={projectId}
            lines={lines}
            onToggleLine={toggleLine}
            onAddManual={addManual}
            onRemoveLine={removeLine}
          />
        )}
        {step === 1 && (
          <StepMaterialDetails
            lines={lines}
            errors={detailErrors}
            locationOptions={locationOptions}
            onPatchLine={patchLine}
          />
        )}
        {step === 2 && (
          <StepReview
            jobCode={jobCode}
            projectName={projectName}
            lines={lines}
            onEditLine={() => setStep(1)}
            onDeleteLine={removeLine}
            onAddMore={() => setStep(0)}
          />
        )}
      </div>

      {step === 0 && selectedCount > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground" data-testid="mr-selected-count">
            {t('requestMaterials.itemsSelected', { count: selectedCount })}
          </span>
          <button
            type="button"
            onClick={() => setLines([])}
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t('requestMaterials.clearAll')}
          </button>
        </div>
      )}

      {step === 2 && (
        <p className="mt-4 text-center text-xs text-muted-foreground sm:text-left">
          {t('review.footerHint')}
        </p>
      )}

      {submitError && (
        <StatusErrorModal
          title={t('review.submitFailed')}
          description={submitError}
          primaryButtonLabel={t('review.tryAgain')}
          onPrimaryClick={() => {
            setSubmitError(null);
            handleSubmit();
          }}
          secondaryButtonLabel={t('review.dismiss')}
          onSecondaryClick={() => setSubmitError(null)}
          onClose={() => setSubmitError(null)}
        />
      )}
    </MobileShell>
  );

  /** Step-specific navigation, rendered in the page-header actions slot. */
  function renderActions() {
    if (step === 0) {
      return (
        <PrimaryButton
          withArrow
          onClick={handleContinueFromSelect}
          disabled={selectedCount === 0}
          className="w-full sm:w-auto"
          data-testid="mr-step1-next"
        >
          {t('requestMaterials.next')}
        </PrimaryButton>
      );
    }
    if (step === 1) {
      return (
        <PrimaryButton
          withArrow
          onClick={handleContinueFromDetails}
          className="w-full sm:w-auto"
          data-testid="mr-step2-next"
        >
          {t('materialDetails.next')}
        </PrimaryButton>
      );
    }
    // step 2 — Review
    return (
      <>
        <SecondaryButton
          disabled
          title={t('review.raisePoUnavailable')}
          className="w-full sm:w-auto"
          data-testid="mr-raise-po"
        >
          {t('review.raisePo')}
        </SecondaryButton>
        <PrimaryButton
          onClick={handleSubmit}
          disabled={createMutation.isPending || lines.length === 0}
          className="w-full sm:w-auto"
          data-testid="mr-submit"
          leading={<CheckIcon />}
        >
          {t('review.submit')}
        </PrimaryButton>
      </>
    );
  }
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13.5 4.5L6 12L2.5 8.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
