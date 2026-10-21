import { NominateApproversModal } from '@forethread/approval-shared';
import { useTranslation } from '@forethread/i18n';
import { scrollToFirstInvalid, useWizardChrome } from '@forethread/po-shared';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { MobileActionBar, StatusErrorModal, useIsPhone } from '@forethread/ui-components';
import RequestIcon from '@forethread/ui-components/assets/icons/request.svg?react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useAuthStore } from '@/features/auth/state/auth.store';

import { PrimaryButton, SecondaryButton } from '../components/MobileButtons';
import { MobileHeader } from '../components/MobileHeader';
import { MobileShell } from '../components/MobileShell';
import { type NewMaterialDraft } from '../components/NewMaterialModal';
import {
  StepMaterialDetails,
  type DeliveryLocationOption,
  type MemberOption,
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
  const [showNominate, setShowNominate] = useState(false);
  // Remembered so the error modal's "try again" resubmits with the same choice.
  const [nomineeIds, setNomineeIds] = useState<string[]>([]);

  // SUPER_ADMIN has no company, hence no Approver Pool to pick from — submit
  // directly (mirrors the PO issue path, where SUPER_ADMIN always sends).
  const isSuperAdmin = useAuthStore((s) => s.currentUser?.role === 'SUPER_ADMIN');

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

  // Project members available to CC on a line, deduped by display name (the CC
  // field stores names, which compose into the line notes).
  const memberOptions: MemberOption[] = useMemo(() => {
    const seen = new Set<string>();
    return (project?.assignedUsers ?? []).reduce<MemberOption[]>((acc, user) => {
      if (!seen.has(user.name)) {
        seen.add(user.name);
        acc.push({ id: user.id, name: user.name });
      }
      return acc;
    }, []);
  }, [project?.assignedUsers]);

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
          // Set when the inline row's name was picked from the catalogue — the
          // line is then raised against the real material, not a loose name.
          materialId: draft.materialId,
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
    if (hasDetailsErrors(errors)) {
      scrollToFirstInvalid();
      return;
    }
    setStep(2);
  };

  /**
   * Create-and-submit the MR, optionally nominating approvers (FOR-347). The
   * nominees ride on the create payload because the wizard's submit is a single
   * call — there is no MR id until it returns.
   */
  const submitRequest = (ids: string[]) => {
    if (lines.length === 0) return;
    const base = buildCreateInput({ projectId, lines }, { submit: true });
    const input = ids.length > 0 ? { ...base, nomineeIds: ids } : base;
    createMutation.mutate(input, {
      onSuccess: (mr) => {
        navigate(ROUTES.materialRequestConfirmation.replace(':id', mr.id), {
          state: { mr },
        });
      },
      onError: () => setSubmitError(t('review.submitFailed')),
    });
  };

  /**
   * Submit Request click: every submitted MR requires approval, so the
   * nomination modal is the confirm step — the requester sees who it routes to
   * and may narrow the notification (never the authority).
   */
  const handleSubmit = () => {
    if (lines.length === 0) return;
    if (isSuperAdmin) {
      submitRequest([]);
      return;
    }
    setShowNominate(true);
  };

  const handleConfirmNominees = (ids: string[]) => {
    setNomineeIds(ids);
    submitRequest(ids);
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

  const overviewPath = ROUTES.materialRequestJobOverview.replace(':projectId', projectId);

  // Phones (ADR-0019 B8): the shell top bar carries the title + back arrow
  // (which confirms before dropping picked lines), the bottom nav is hidden,
  // and the step navigation sits in the fixed footer bar.
  const isPhone = useIsPhone();
  const { exitConfirm } = useWizardChrome({
    isDirty: lines.length > 0 && !createMutation.isSuccess,
    onExit: () => navigate(overviewPath),
  });

  // App-bar breadcrumb / page title reflects the current wizard step.
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(headerTitle, null, overviewPath, [
      { label: t('jobOverview.title'), to: overviewPath },
      { label: headerTitle },
    ]);
    return () => setPageTitle(null);
  }, [setPageTitle, headerTitle, overviewPath, t]);

  return (
    <MobileShell
      header={
        isPhone ? undefined : (
          <MobileHeader
            title={headerTitle}
            onBack={goBack}
            icon={<RequestIcon />}
            trailing={renderActions()}
          />
        )
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
            onPatchLine={patchLine}
          />
        )}
        {step === 1 && (
          <StepMaterialDetails
            lines={lines}
            errors={detailErrors}
            locationOptions={locationOptions}
            memberOptions={memberOptions}
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

      {showNominate && !submitError && (
        <NominateApproversModal
          entityType="MATERIAL_REQUEST"
          // No MR exists yet — the modal shows the company's prospective Pool.
          entityId={null}
          mode="submit"
          isSubmitting={createMutation.isPending}
          onClose={() => setShowNominate(false)}
          onConfirm={handleConfirmNominees}
        />
      )}

      {isPhone && (
        <MobileActionBar>
          {step > 0 && (
            <SecondaryButton onClick={goBack} data-testid="mr-back">
              {t('common:back', { defaultValue: 'Back' })}
            </SecondaryButton>
          )}
          {renderPrimaryAction()}
        </MobileActionBar>
      )}

      {exitConfirm}

      {submitError && (
        <StatusErrorModal
          title={t('review.submitFailed')}
          description={submitError}
          primaryButtonLabel={t('review.tryAgain')}
          onPrimaryClick={() => {
            setSubmitError(null);
            submitRequest(nomineeIds);
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
    if (step < 2) return renderPrimaryAction();
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
        {renderPrimaryAction()}
      </>
    );
  }

  /** The step's forward action (Next / Submit Request). */
  function renderPrimaryAction() {
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
    return (
      <PrimaryButton
        onClick={handleSubmit}
        disabled={createMutation.isPending || lines.length === 0}
        className="w-full sm:w-auto"
        data-testid="mr-submit"
        leading={<CheckIcon />}
      >
        {t('review.submit')}
      </PrimaryButton>
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
