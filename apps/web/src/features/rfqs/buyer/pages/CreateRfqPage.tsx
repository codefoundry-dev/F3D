import {
  checkRfqAvailability,
  confirmRfqCoverage,
  deleteRfq,
  uploadRfqDocument,
  type RfqAvailabilityResult,
  type RfqDetail,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Stepper } from '@forethread/po-shared';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { isBomExtractionResult, type SaveRfqDraftValues } from '@forethread/shared-types/client';
import { Button, StatusErrorModal, StatusSuccessModal } from '@forethread/ui-components';
import ArrowRightIcon from '@forethread/ui-components/assets/icons/arrow-right.svg?react';
import BackArrowIcon from '@forethread/ui-components/assets/icons/back-arrow.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useConfirmedBoms } from '@/features/doc-intelligence';

import {
  autoCoverAllocations,
  remainingQty,
  type AllocationMap,
} from '../components/create/availability';
import { bomLineToRfqDraftFields } from '../components/create/bom-draft';
import { EditMaterialModal } from '../components/create/EditMaterialModal';
import { SelectVendorsCard } from '../components/create/SelectVendorsCard';
import { AddFromBomModal, AddFromMaterialListModal } from '../components/create/source-modals';
import { StepBasicInfo } from '../components/create/StepBasicInfo';
import { StepLineItems } from '../components/create/StepLineItems';
import { StepReviewSend, type PendingAttachment } from '../components/create/StepReviewSend';
import {
  EMPTY_BASIC_INFO,
  nextLineKey,
  validateBasicInfo,
  validateLineItems,
  type WizardBasicInfo,
  type WizardFieldErrors,
  type WizardLineItem,
  type WizardSeed,
} from '../components/create/wizard-types';
import { WizardAccordion } from '../components/create/WizardAccordion';
import {
  useAssignedVendors,
  useRfqMaterials,
  useRfqProjects,
  useSaveRfqDraft,
  useSendRfq,
  useUpdateRfq,
} from '../services/rfqs.service';

type WizardPhase = 'steps' | 'noRfqRequired';

const STEP_COUNT = 2;

/** YYYY-MM-DD (DatePicker) → ISO datetime (the zod schemas use `.datetime()`). */
function toIsoDate(date: string | undefined): string | undefined {
  if (!date) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00.000Z` : date;
}

/** Build the SaveRfqDraft / UpdateRfq payload from the wizard state. */
function buildPayload(
  basicInfo: WizardBasicInfo,
  items: WizardLineItem[],
  vendorIds: string[],
  salesRepIds: string[],
  message: string,
): SaveRfqDraftValues {
  const payload: SaveRfqDraftValues = {
    projectId: basicInfo.projectIds[0],
    projectIds: basicInfo.projectIds,
    name: basicInfo.documentName || undefined,
    isPickUp: basicInfo.isPickUp || undefined,
    pickUpLocation: basicInfo.isPickUp ? basicInfo.pickUpLocation || undefined : undefined,
    holdForRelease: basicInfo.holdForRelease || undefined,
  } as SaveRfqDraftValues;

  if (basicInfo.responseDeadline) payload.deadlineEnd = toIsoDate(basicInfo.responseDeadline);
  if (basicInfo.needByDate) payload.needByDate = toIsoDate(basicInfo.needByDate);
  if (basicInfo.holdForRelease && basicInfo.earliestDeliveryDate) {
    payload.earliestDeliveryDate = toIsoDate(basicInfo.earliestDeliveryDate);
  }
  if (message.trim()) payload.message = message.trim();
  if (vendorIds.length > 0) payload.vendorIds = vendorIds;
  if (salesRepIds.length > 0) payload.salesRepIds = salesRepIds;

  if (items.length > 0) {
    payload.lineItems = items.map((item) => {
      const base = {
        quantity: item.quantity,
        uom: item.uom,
        notes: item.notes,
        projectId: item.projectId,
        expectedDeliveryDate: toIsoDate(item.expectedDeliveryDate),
        description: item.description,
      };
      if (item.materialId) {
        return {
          source: item.source === 'BOM' ? 'BOM' : 'CATALOG',
          materialId: item.materialId,
          ...base,
        };
      }
      return { source: 'BOM', materialName: item.materialName, ...base };
    }) as SaveRfqDraftValues['lineItems'];
  }

  return payload;
}

/** Map server line-item ids back onto local rows (persisted in array order). */
function withServerIds(items: WizardLineItem[], detail: RfqDetail): WizardLineItem[] {
  const serverItems = detail.lineItems ?? [];
  if (serverItems.length !== items.length) return items;
  return items.map((item, index) => ({
    ...item,
    serverId: serverItems[index]?.id ?? item.serverId,
  }));
}

/**
 * Create New RFQ wizard (Figma US 5.05 — node 2974:38530). Two steps: a
 * consolidated first step (RFQ basic information + a Select-Vendors accordion +
 * an Add-Line-Items accordion with inline bulk-order coverage), then Review &
 * Send. Drafts save as you go, bulk-order coverage can short-circuit to the
 * No-RFQ-Required terminal state. Delivery is captured per line item, not at
 * the RFQ level.
 */
export default function CreateRfqPage() {
  const { t } = useTranslation('rfqs');
  const navigate = useNavigate();
  const location = useLocation();
  const seededRef = useRef(false);

  // App-bar breadcrumb: RFQ Management › Create New RFQ.
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(t('create.title'), t('create.subtitle'), ROUTES.rfqs, [
      { label: t('list.title'), to: ROUTES.rfqs },
      { label: t('create.title') },
    ]);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  const seed = (location.state as { seed?: WizardSeed } | null)?.seed;

  const [phase, setPhase] = useState<WizardPhase>('steps');
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<WizardFieldErrors>({});
  const [draftId, setDraftId] = useState<string | null>(null);

  const [basicInfo, setBasicInfo] = useState<WizardBasicInfo>(EMPTY_BASIC_INFO);
  const [vendorIds, setVendorIds] = useState<string[]>([]);
  const [salesRepIds, setSalesRepIds] = useState<string[]>([]);
  const [items, setItems] = useState<WizardLineItem[]>([]);
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);

  const [materialSearch, setMaterialSearch] = useState('');
  const [showAddFromBom, setShowAddFromBom] = useState(false);
  const [showAddFromMaterialList, setShowAddFromMaterialList] = useState(false);
  const [editingItem, setEditingItem] = useState<WizardLineItem | null>(null);

  const [availability, setAvailability] = useState<RfqAvailabilityResult | undefined>(undefined);
  const [availabilityChecked, setAvailabilityChecked] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [allocations, setAllocations] = useState<AllocationMap>(new Map());

  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'success' | 'error'>(
    'idle',
  );
  const [submitError, setSubmitError] = useState<string>('');

  // ── Data sources ──────────────────────────────────────────────────────────
  const { data: projects = [], isLoading: projectsLoading } = useRfqProjects();
  const { data: vendors = [], isLoading: vendorsLoading } = useAssignedVendors();
  const { data: materials = [] } = useRfqMaterials(
    materialSearch ? { search: materialSearch } : undefined,
  );

  const selectedProjects = useMemo(
    () =>
      basicInfo.projectIds
        .map((id) => projects.find((p) => p.id === id))
        .filter(Boolean) as typeof projects,
    [basicInfo.projectIds, projects],
  );

  // ── Legacy seeding: "Convert a project BOM" upload flow (FOR-200) hands
  // over a confirmed doc-intelligence extraction id via router state. ───────
  const bomExtractionId = (location.state as { bomExtractionId?: string } | null)?.bomExtractionId;
  const { data: confirmedBomsPage } = useConfirmedBoms();
  useEffect(() => {
    if (seededRef.current || !bomExtractionId) return;
    const bom = confirmedBomsPage?.items.find((item) => item.id === bomExtractionId);
    if (!bom || !isBomExtractionResult(bom.editedResult)) return;
    const drafts = bom.editedResult.items
      .map((item) => {
        const fields = bomLineToRfqDraftFields(item);
        const unit = item.unit?.trim();
        return {
          key: nextLineKey(),
          source: 'BOM' as const,
          materialId: fields.materialId,
          materialName: fields.materialName,
          notes: fields.notes,
          quantity: typeof item.quantity === 'number' && item.quantity >= 0.01 ? item.quantity : 1,
          uom: unit && unit.length > 0 ? unit : 'unit',
        };
      })
      .filter((draft) => draft.materialName.trim().length > 0);
    if (drafts.length === 0) return;
    seededRef.current = true;
    setItems(drafts);
  }, [bomExtractionId, confirmedBomsPage]);

  // ── Seeding (Converting BOM / Create from material list) ─────────────────
  useEffect(() => {
    if (seededRef.current || !seed) return;
    seededRef.current = true;
    setItems(
      seed.items.map((item) => ({
        key: nextLineKey(),
        source: item.source,
        materialId: item.materialId,
        materialName: item.materialName,
        description: item.description,
        quantity: item.quantity,
        uom: item.uom,
        projectId: item.projectId,
      })),
    );
    if (seed.projectIds && seed.projectIds.length > 0) {
      setBasicInfo((prev) => ({ ...prev, projectIds: seed.projectIds as string[] }));
    }
  }, [seed]);

  const projectLocked = Boolean(seed?.source === 'BOM' && seed.projectIds?.length);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveDraft = useSaveRfqDraft();
  const updateDraft = useUpdateRfq();
  const sendRfq = useSendRfq();
  const isSaving = saveDraft.isPending || updateDraft.isPending;

  const persist = async (): Promise<RfqDetail> => {
    const payload = buildPayload(basicInfo, items, vendorIds, salesRepIds, message);
    if (draftId) {
      const { projectId: _omit, ...patch } = payload;
      void _omit;
      const updated = await updateDraft.mutateAsync({ id: draftId, dto: patch });
      return updated;
    }
    const created = await saveDraft.mutateAsync(payload);
    setDraftId(created.id);
    return created;
  };

  // ── Step navigation ───────────────────────────────────────────────────────
  const stepLabels = [t('create.steps.basicInfo'), t('create.steps.review')];

  const validateCurrentStep = (): boolean => {
    let stepErrors: WizardFieldErrors = {};
    if (step === 0) {
      stepErrors = { ...validateBasicInfo(basicInfo, vendorIds), ...validateLineItems(items) };
    }
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const goToStep = (target: number) => {
    setErrors({});
    setStep(target);
    window.scrollTo({ top: 0 });
  };

  /** Every draft save requires a project (server-side). Guide the user to the
   * RFQ Information field rather than failing the save with a generic error. */
  const ensureProjectSelected = (): boolean => {
    if (basicInfo.projectIds.length > 0) return true;
    setErrors((prev) => ({ ...prev, projectIds: 'required' }));
    window.scrollTo({ top: 0 });
    return false;
  };

  /** Persist the draft and fetch bulk-order coverage for the current rows. */
  const handleCheckAvailability = async () => {
    if (!ensureProjectSelected()) return;
    const lineErrors = validateLineItems(items);
    if (Object.keys(lineErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...lineErrors }));
      return;
    }
    try {
      const detail = await persist();
      const synced = withServerIds(items, detail);
      setItems(synced);
      setAvailabilityChecked(true);
      setAvailabilityLoading(true);
      try {
        const result = await checkRfqAvailability({
          lineItems: synced.map((item, index) => ({
            index,
            materialId: item.materialId,
            materialName: item.materialName,
            quantity: item.quantity,
            uom: item.uom,
          })),
        });
        setAvailability(result);
        // Auto-cover everything the bulk orders can serve; buyers can still
        // Cancel a row if they'd rather quote it out.
        setAllocations(autoCoverAllocations(synced, result));
      } finally {
        setAvailabilityLoading(false);
      }
    } catch {
      // Mutation errors surface via the saving alert below.
    }
  };

  const handleContinue = async () => {
    if (step !== 0) return;
    if (!validateCurrentStep()) return;

    try {
      const detail = await persist();
      const synced = withServerIds(items, detail);
      setItems(synced);

      // Apply any bulk-order coverage selected inline before sending the RFQ.
      const flat = [...allocations.values()].flatMap((byVendor) => [...byVendor.values()]);
      if (flat.length > 0) {
        const serverIdOf = new Map(synced.map((item) => [item.key, item.serverId]));
        const result = await confirmRfqCoverage(detail.id, {
          allocations: flat
            .filter((allocation) => serverIdOf.get(allocation.lineKey))
            .map((allocation) => ({
              rfqLineItemId: serverIdOf.get(allocation.lineKey) as string,
              bulkOrderLineItemId: allocation.bulkOrderLineItemId,
              quantity: allocation.quantity,
            })),
        });

        // Apply coverage locally: drop fully covered rows, reduce partials.
        const nextItems = synced
          .map((item) => ({ ...item, quantity: remainingQty(item, allocations) }))
          .filter((item) => item.quantity > 0);

        if (result.remainingLineItems === 0 || nextItems.length === 0) {
          // Everything is covered by bulk orders — no RFQ needed. Discard the
          // empty draft (drawdowns have already been created server-side).
          await deleteRfq(detail.id).catch(() => undefined);
          setPhase('noRfqRequired');
          return;
        }
        setItems(nextItems);
        setAllocations(new Map());
        setAvailabilityChecked(false);
      }
      goToStep(1);
    } catch {
      // Mutation errors surface via the saving alert below.
    }
  };

  const handleBack = () => {
    setErrors({});
    if (step > 0) setStep(step - 1);
  };

  const handleSaveAsDraft = async () => {
    if (!ensureProjectSelected()) return;
    try {
      const detail = await persist();
      navigate(ROUTES.rfqDetail.replace(':id', detail.id));
    } catch {
      // surfaced by isSaveError
    }
  };

  const handleSubmit = async () => {
    setSubmitState('submitting');
    try {
      const detail = await persist();
      for (const attachment of attachments) {
        await uploadRfqDocument(detail.id, attachment.file);
      }
      await sendRfq.mutateAsync({ id: detail.id });
      setSubmitState('success');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t('create.submit.genericError'));
      setSubmitState('error');
    }
  };

  const addSeedItems = (seedItems: WizardSeed['items']) => {
    setItems((prev) => [
      ...prev,
      ...seedItems.map((item) => ({
        key: nextLineKey(),
        source: item.source,
        materialId: item.materialId,
        materialName: item.materialName,
        description: item.description,
        quantity: item.quantity,
        uom: item.uom,
        projectId: item.projectId ?? basicInfo.projectIds[0],
      })),
    ]);
    // Adding a BOM from another project extends the project selection so the
    // new rows have a visible group.
    setBasicInfo((prev) => {
      const missing = seedItems
        .map((item) => item.projectId)
        .filter(
          (projectId): projectId is string =>
            Boolean(projectId) && !prev.projectIds.includes(projectId as string),
        );
      if (missing.length === 0) return prev;
      return { ...prev, projectIds: [...prev.projectIds, ...new Set(missing)] };
    });
  };

  const isSaveError = saveDraft.isError || updateDraft.isError;

  // Shared page heading (back arrow + title), used by the wizard and the
  // terminal "No RFQ Required" screen (Figma keeps the header on both).
  const pageHeader = (
    <div className="flex items-center gap-3 pb-4">
      <button
        type="button"
        onClick={() => navigate(ROUTES.rfqs)}
        className="p-1.5 rounded-lg text-foreground hover:bg-accent transition-colors"
        aria-label={t('create.backToList')}
      >
        <BackArrowIcon className="w-5 h-5" />
      </button>
      <div>
        <h1 className="text-xl font-bold text-foreground leading-6">{t('create.title')}</h1>
        <p className="text-[13px] text-muted-foreground">{t('create.subtitle')}</p>
      </div>
    </div>
  );

  // ── Terminal "No RFQ Required" state ──────────────────────────────────────
  if (phase === 'noRfqRequired') {
    return (
      <div className="p-4 sm:px-10 flex flex-col flex-1 min-h-full bg-secondary">
        {pageHeader}
        <div className="flex flex-col flex-1 items-center justify-center px-6 text-center">
          <div className="w-12 h-12 rounded-[12px] bg-muted flex items-center justify-center mb-6">
            <NewUserIcon className="w-6 h-6 text-foreground" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground">
            {t('create.noRfqRequired.title')}
          </h1>
          <p className="text-base text-muted-foreground mt-4 max-w-3xl">
            {t('create.noRfqRequired.description')}
          </p>
          <div className="flex flex-col gap-2 w-full max-w-xl mt-8">
            <Button
              className="w-full h-12"
              onClick={() => navigate(ROUTES.purchaseOrders)}
              data-testid="no-rfq-create-po"
            >
              {t('create.noRfqRequired.createPo')}
            </Button>
            <Button variant="outline" className="w-full h-12" onClick={() => navigate(ROUTES.rfqs)}>
              {t('create.noRfqRequired.mainPage')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const stepHeading = [
    { title: t('create.headings.step1Title'), subtitle: t('create.headings.step1Subtitle') },
    { title: t('create.headings.step4Title'), subtitle: t('create.headings.step4Subtitle') },
  ][step];

  return (
    <div className="p-4 sm:px-10 flex flex-col flex-1 min-h-full bg-secondary">
      {pageHeader}

      <Stepper step={step + 1} labels={stepLabels} />

      <div className="flex flex-col flex-1 pt-6 max-w-[1336px] w-full mx-auto">
        <div className="mb-5">
          <h2 className="text-2xl font-semibold text-foreground">
            {t('create.stepOf', { current: step + 1, total: STEP_COUNT })}
            {stepHeading.title}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{stepHeading.subtitle}</p>
        </div>

        <div className="space-y-6 flex-1">
          {step === 0 && (
            <>
              <StepBasicInfo
                values={basicInfo}
                onChange={(patch) => setBasicInfo((prev) => ({ ...prev, ...patch }))}
                projects={projects}
                errors={errors}
                projectLocked={projectLocked}
              />

              <WizardAccordion
                title={t('create.vendors.cardTitle')}
                subtitle={t('create.vendors.cardSubtitle')}
                summary={
                  <span className="text-xs text-muted-foreground">
                    {t('create.vendors.selectedCount', { count: vendorIds.length })}
                  </span>
                }
                testId="vendors-accordion"
              >
                <SelectVendorsCard
                  vendors={vendors}
                  selectedVendorIds={vendorIds}
                  selectedRepIds={salesRepIds}
                  isLoading={vendorsLoading || projectsLoading}
                  onChange={({ vendorIds: nextVendorIds, repIds }) => {
                    setVendorIds(nextVendorIds);
                    setSalesRepIds(repIds);
                  }}
                  error={errors.vendorIds ? t('create.vendors.selectAtLeastOne') : undefined}
                />
              </WizardAccordion>

              <WizardAccordion
                title={t('create.lineItems.cardTitle')}
                subtitle={t('create.lineItems.cardSubtitle')}
                summary={
                  <span className="text-xs text-muted-foreground">
                    {t('create.lineItems.totalItems')} {items.length}
                  </span>
                }
                testId="line-items-accordion"
              >
                <StepLineItems
                  items={items}
                  onItemsChange={setItems}
                  projects={selectedProjects}
                  materials={materials}
                  search={materialSearch}
                  onSearchChange={setMaterialSearch}
                  onOpenAddFromBom={() => setShowAddFromBom(true)}
                  onOpenAddFromMaterialList={() => setShowAddFromMaterialList(true)}
                  error={
                    errors.lineItems ? t(`create.errors.${errors.lineItems}` as never) : undefined
                  }
                  onCheckAvailability={() => void handleCheckAvailability()}
                  availability={availability}
                  availabilityChecked={availabilityChecked}
                  availabilityLoading={availabilityLoading}
                  allocations={allocations}
                  onAllocationsChange={setAllocations}
                />
              </WizardAccordion>
            </>
          )}

          {step === 1 && (
            <StepReviewSend
              basicInfo={basicInfo}
              items={items}
              projects={projects}
              vendors={vendors}
              selectedVendorIds={vendorIds}
              selectedRepIds={salesRepIds}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              message={message}
              onMessageChange={setMessage}
              onEditStep={goToStep}
              onEditItem={setEditingItem}
              onRemoveItem={(key) => setItems((prev) => prev.filter((item) => item.key !== key))}
              onRemoveVendor={(vendorId) => {
                const repIdsOfVendor = new Set(
                  (vendors.find((v) => v.companyId === vendorId)?.representatives ?? []).map(
                    (rep) => rep.id,
                  ),
                );
                setVendorIds((prev) => prev.filter((id) => id !== vendorId));
                setSalesRepIds((prev) => prev.filter((id) => !repIdsOfVendor.has(id)));
              }}
            />
          )}

          {isSaveError && (
            <p className="text-sm text-destructive">{t('create.errors.saveFailed')}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 py-6">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => void handleSaveAsDraft()}
            isLoading={isSaving}
            data-testid="save-as-draft"
          >
            {t('create.footer.saveAsDraft')}
          </Button>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleBack}
              disabled={step === 0 || isSaving}
              leftIcon={<BackArrowIcon className="w-4 h-4" />}
              data-testid="wizard-back"
            >
              {t('create.footer.back')}
            </Button>
            {step === 1 ? (
              <Button
                type="button"
                size="lg"
                onClick={() => void handleSubmit()}
                isLoading={submitState === 'submitting'}
                data-testid="submit-rfq"
              >
                {t('create.footer.submitRfq')}
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                onClick={() => void handleContinue()}
                isLoading={isSaving || availabilityLoading}
                rightIcon={<ArrowRightIcon className="w-4 h-4" />}
                data-testid="wizard-continue"
              >
                {t('create.footer.continue')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {showAddFromBom && (
        <AddFromBomModal
          projectIds={basicInfo.projectIds}
          projects={projects}
          onAdd={addSeedItems}
          onClose={() => setShowAddFromBom(false)}
        />
      )}

      {showAddFromMaterialList && (
        <AddFromMaterialListModal
          onAdd={addSeedItems}
          onClose={() => setShowAddFromMaterialList(false)}
        />
      )}

      {editingItem && (
        <EditMaterialModal
          item={editingItem}
          onConfirm={(patch) =>
            setItems((prev) =>
              prev.map((item) => (item.key === editingItem.key ? { ...item, ...patch } : item)),
            )
          }
          onClose={() => setEditingItem(null)}
        />
      )}

      {submitState === 'success' && (
        <StatusSuccessModal
          onClose={() => navigate(ROUTES.rfqs)}
          title={t('create.submit.successTitle')}
          description={t('create.submit.successDescription')}
          buttonLabel={t('create.submit.backToRfqs')}
          redirectLabel={(seconds) => t('create.submit.redirecting', { seconds })}
          countdownSeconds={3}
        />
      )}

      {submitState === 'error' && (
        <StatusErrorModal
          onClose={() => setSubmitState('idle')}
          title={t('create.submit.errorTitle', { error: submitError })}
          description=""
          primaryButtonLabel={t('create.submit.tryAgain')}
          onPrimaryClick={() => void handleSubmit()}
          secondaryButtonLabel={t('create.submit.dismiss')}
          onSecondaryClick={() => setSubmitState('idle')}
        />
      )}
    </div>
  );
}
