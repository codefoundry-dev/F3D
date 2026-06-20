import { useTranslation } from '@forethread/i18n';
import { StatusErrorModal } from '@forethread/ui-components';
import { useCallback, useMemo, useState } from 'react';
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

const STEP_COUNT = 3;

/**
 * Host for the 3-step "Raise a Material Request" wizard (Figma 2002:176). Owns
 * the wizard line state; renders the per-step component plus the dark header,
 * progress bar and pinned footer. The footer uses separate button nodes per
 * step (never a native form submit) to avoid the step→final button-morph submit
 * bug documented in prior sessions.
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

  const headerTitle =
    step === 0
      ? t('requestMaterials.title')
      : step === 1
        ? t('materialDetails.title')
        : t('review.title');

  const progressLabel = headerTitle;

  return (
    <MobileShell
      header={<MobileHeader title={headerTitle} onBack={goBack} />}
      footer={renderFooter()}
    >
      <StepProgress current={step + 1} total={STEP_COUNT} label={progressLabel} />

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

  function renderFooter() {
    if (step === 0) {
      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#525866]" data-testid="mr-selected-count">
              {t('requestMaterials.itemsSelected', { count: selectedCount })}
            </span>
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={() => setLines([])}
                className="text-sm text-[#6D7588] underline"
              >
                {t('requestMaterials.clearAll')}
              </button>
            )}
          </div>
          <PrimaryButton
            withArrow
            onClick={handleContinueFromSelect}
            disabled={selectedCount === 0}
            data-testid="mr-step1-next"
          >
            {t('requestMaterials.next')}
          </PrimaryButton>
        </div>
      );
    }
    if (step === 1) {
      return (
        <div className="flex flex-col gap-3">
          <PrimaryButton withArrow onClick={handleContinueFromDetails} data-testid="mr-step2-next">
            {t('materialDetails.next')}
          </PrimaryButton>
          <SecondaryButton onClick={goBack}>{t('materialDetails.back')}</SecondaryButton>
        </div>
      );
    }
    // step 2 — Review
    return (
      <div className="flex flex-col gap-3">
        <PrimaryButton
          onClick={handleSubmit}
          disabled={createMutation.isPending || lines.length === 0}
          data-testid="mr-submit"
          leading={<CheckIcon />}
        >
          {t('review.submit')}
        </PrimaryButton>
        <SecondaryButton disabled title={t('review.raisePoUnavailable')} data-testid="mr-raise-po">
          {t('review.raisePo')}
        </SecondaryButton>
        <p className="text-center text-xs text-[#6D7588]">{t('review.footerHint')}</p>
      </div>
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
