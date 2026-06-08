import type { BomLineItem, SaveRfqDraftValues } from '@forethread/shared-types/client';
import {
  isBomExtractionResult,
  RfqLineItemSource,
  rfqStepProjectSchema,
  rfqStepMaterialsSchema,
  rfqStepVendorsSchema,
  rfqStepDeliverySchema,
} from '@forethread/shared-types/client';
import { Alert, Button } from '@forethread/ui-components';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useConfirmedBoms } from '@/features/doc-intelligence';

import { deriveBomLineNameAndNotes } from '../components/create/bom-draft';
import { SendRfqDialog } from '../components/create/SendRfqDialog';
import { StepDelivery, type DeliveryStepValues } from '../components/create/StepDelivery';
import { StepIndicator } from '../components/create/StepIndicator';
import { StepMaterials, type RfqLineItemDraft } from '../components/create/StepMaterials';
import { StepProject } from '../components/create/StepProject';
import { StepReview } from '../components/create/StepReview';
import { StepVendors } from '../components/create/StepVendors';
import {
  useSaveRfqDraft,
  useUpdateRfq,
  useSendRfq,
  useRfqProjects,
  useProjectDeliveryLocations,
  useRfqMaterials,
  useAssignedVendors,
} from '../services/rfqs.service';

const STEPS = ['Project', 'Materials', 'Vendors', 'Delivery & specs', 'Review'];

type FieldErrors = Record<string, string>;

/** Build the SaveRfqDraft / UpdateRfq payload from the slices completed so far. */
function buildPayload(
  projectId: string,
  lineItems: RfqLineItemDraft[],
  vendorIds: string[],
  delivery: DeliveryStepValues,
  upToStep: number,
): SaveRfqDraftValues {
  const payload: SaveRfqDraftValues = { projectId };

  if (upToStep >= 1 && lineItems.length > 0) {
    payload.lineItems = lineItems.map((item) =>
      item.source === 'BOM'
        ? {
            source: RfqLineItemSource.BOM,
            materialName: item.materialName,
            quantity: item.quantity,
            uom: item.uom,
            costCode: item.costCode,
            notes: item.notes,
            pickUp: item.pickUp,
          }
        : {
            source: RfqLineItemSource.CATALOG,
            materialId: item.materialId,
            quantity: item.quantity,
            uom: item.uom,
            costCode: item.costCode,
            notes: item.notes,
            pickUp: item.pickUp,
          },
    );
  }
  if (upToStep >= 2 && vendorIds.length > 0) {
    payload.vendorIds = vendorIds;
  }
  if (upToStep >= 3) {
    if (delivery.deadlineEnd) payload.deadlineEnd = delivery.deadlineEnd;
    if (delivery.deliveryLocationId) payload.deliveryLocationId = delivery.deliveryLocationId;
    if (delivery.needByDate) payload.needByDate = delivery.needByDate;
    if (delivery.holdForRelease) payload.holdForRelease = delivery.holdForRelease;
    if (delivery.earliestDeliveryDate) payload.earliestDeliveryDate = delivery.earliestDeliveryDate;
    if (delivery.currency) payload.currency = delivery.currency;
    if (delivery.message) payload.message = delivery.message;
  }

  return payload;
}

/**
 * Map a parsed BOM line into an RFQ line-item draft. The extraction can leave
 * quantity/unit null, so fall back to schema-valid defaults (quantity ≥ 0.01,
 * a non-empty UoM) — seeded lines then never block the Materials step, and the
 * contractor can adjust or remove them before sending.
 */
function bomItemToDraft(item: BomLineItem): RfqLineItemDraft {
  const quantity = typeof item.quantity === 'number' && item.quantity >= 0.01 ? item.quantity : 1;
  const unit = item.unit?.trim() ?? '';
  const { materialName, notes } = deriveBomLineNameAndNotes(item);
  return {
    source: 'BOM',
    materialName,
    quantity,
    uom: unit.length > 0 ? unit : 'unit',
    notes,
  };
}

export default function CreateRfqPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const seededFromBomRef = useRef(false);

  const [step, setStep] = useState(0);
  const [furthestReached, setFurthestReached] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [draftId, setDraftId] = useState<string | null>(null);
  const [showSendDialog, setShowSendDialog] = useState(false);

  // ── Form slices ───────────────────────────────────────────────────────────
  const [projectId, setProjectId] = useState('');
  const [lineItems, setLineItems] = useState<RfqLineItemDraft[]>([]);
  const [vendorIds, setVendorIds] = useState<string[]>([]);
  const [materialSearch, setMaterialSearch] = useState('');
  const [delivery, setDelivery] = useState<DeliveryStepValues>({
    deadlineEnd: '',
    deliveryLocationId: '',
  });

  // ── Data sources ──────────────────────────────────────────────────────────
  const { data: projects = [], isLoading: projectsLoading } = useRfqProjects();
  const { data: materials = [] } = useRfqMaterials(
    materialSearch ? { search: materialSearch } : undefined,
  );
  const { data: vendors = [], isLoading: vendorsLoading } = useAssignedVendors();
  const { data: locations = [], isLoading: locationsLoading } =
    useProjectDeliveryLocations(projectId);
  const { data: confirmedBomsPage } = useConfirmedBoms();
  const confirmedBoms = confirmedBomsPage?.items ?? [];

  // When the contractor arrives from "Convert a project BOM" (BomConversionPage),
  // seed the Materials step from that confirmed BOM's parsed line items — runs
  // once, as soon as the target extraction is available (FOR-200).
  const bomExtractionId = (location.state as { bomExtractionId?: string } | null)?.bomExtractionId;
  useEffect(() => {
    if (seededFromBomRef.current || !bomExtractionId) return;
    const bom = confirmedBomsPage?.items.find((item) => item.id === bomExtractionId);
    if (!bom || !isBomExtractionResult(bom.editedResult)) return;
    const drafts = bom.editedResult.items
      .map(bomItemToDraft)
      .filter((draft) => draft.materialName.trim().length > 0);
    if (drafts.length === 0) return;
    seededFromBomRef.current = true;
    setLineItems(drafts);
  }, [bomExtractionId, confirmedBomsPage]);

  // ── Mutations (save-as-you-go) ─────────────────────────────────────────────
  const saveDraft = useSaveRfqDraft();
  const updateDraft = useUpdateRfq();
  const sendRfq = useSendRfq();
  const isSaving = saveDraft.isPending || updateDraft.isPending;
  const isSaveError = saveDraft.isError || updateDraft.isError;

  const selectedProjectName = useMemo(
    () => projects.find((p) => p.id === projectId)?.name ?? '',
    [projects, projectId],
  );

  /** Validate the slice owned by `targetStep`. Returns true when valid. */
  const validateStep = (targetStep: number): boolean => {
    let result;
    switch (targetStep) {
      case 0:
        result = rfqStepProjectSchema.safeParse({ projectId });
        break;
      case 1:
        result = rfqStepMaterialsSchema.safeParse({ lineItems });
        break;
      case 2:
        result = rfqStepVendorsSchema.safeParse({ vendorIds });
        break;
      case 3:
        result = rfqStepDeliverySchema.safeParse(delivery);
        break;
      default:
        return true;
    }
    if (result.success) {
      setErrors({});
      return true;
    }
    const fieldErrors: FieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0]?.toString() ?? 'form';
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    setErrors(fieldErrors);
    return false;
  };

  /**
   * Persist completed slices up to (and including) `completedStep`, returning
   * the draft's id. Returning it (rather than relying on the async `draftId`
   * state) lets callers act on the id in the same tick — needed so "Send" can
   * immediately POST /rfqs/:id/send after the final save.
   */
  const persist = async (completedStep: number): Promise<string> => {
    const payload = buildPayload(projectId, lineItems, vendorIds, delivery, completedStep);
    if (draftId) {
      const { projectId: _omit, ...patch } = payload;
      void _omit;
      await updateDraft.mutateAsync({ id: draftId, dto: patch });
      return draftId;
    }
    const created = await saveDraft.mutateAsync(payload);
    setDraftId(created.id);
    return created.id;
  };

  const handleNext = async () => {
    if (!validateStep(step)) return;
    try {
      await persist(step);
    } catch {
      return; // mutation error surfaces via isSaveError
    }
    const next = Math.min(step + 1, STEPS.length - 1);
    setStep(next);
    setFurthestReached((prev) => Math.max(prev, next));
  };

  const handleBack = () => {
    setErrors({});
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleStepClick = (target: number) => {
    if (target <= furthestReached) {
      setErrors({});
      setStep(target);
    }
  };

  const handleSaveAsDraft = async () => {
    try {
      const id = await persist(3);
      navigate(ROUTES.rfqDetail.replace(':id', id));
    } catch {
      // error surfaces via isSaveError
    }
  };

  /**
   * Persist the final slice, then send the RFQ to its vendors. Saving first
   * guarantees the server has the latest line items / vendors / delivery before
   * the send-time precondition checks run. On success the RFQ is OPEN, so we
   * land the user on its detail page.
   */
  const handleConfirmSend = async (cc: string[]) => {
    try {
      const id = await persist(3);
      const sent = await sendRfq.mutateAsync({ id, cc });
      setShowSendDialog(false);
      navigate(ROUTES.rfqDetail.replace(':id', sent.id));
    } catch {
      // error surfaces inside the dialog via sendRfq.isError
    }
  };

  const isReviewStep = step === STEPS.length - 1;

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Create RFQ</h1>
      </div>

      <div className="mb-8">
        <StepIndicator
          steps={STEPS}
          current={step}
          furthestReached={furthestReached}
          onStepClick={handleStepClick}
        />
      </div>

      <div className="space-y-6">
        {step === 0 && (
          <StepProject
            projects={projects}
            value={projectId}
            onChange={(id) => {
              setProjectId(id);
              setDelivery((prev) => ({ ...prev, deliveryLocationId: '' }));
            }}
            error={errors.projectId}
            isLoading={projectsLoading}
          />
        )}

        {step === 1 && (
          <StepMaterials
            materials={materials}
            search={materialSearch}
            onSearchChange={setMaterialSearch}
            lineItems={lineItems}
            onAdd={(item) => setLineItems((prev) => [...prev, item])}
            onRemove={(index) => setLineItems((prev) => prev.filter((_, i) => i !== index))}
            confirmedBoms={confirmedBoms}
            error={errors.lineItems}
          />
        )}

        {step === 2 && (
          <StepVendors
            vendors={vendors}
            selectedIds={vendorIds}
            isLoading={vendorsLoading}
            onToggle={(id, checked) =>
              setVendorIds((prev) =>
                checked ? [...prev, id] : prev.filter((vendorId) => vendorId !== id),
              )
            }
            error={errors.vendorIds}
          />
        )}

        {step === 3 && (
          <StepDelivery
            locations={locations}
            locationsLoading={locationsLoading}
            values={delivery}
            onChange={(patch) => setDelivery((prev) => ({ ...prev, ...patch }))}
            errors={{
              deadlineEnd: errors.deadlineEnd,
              deliveryLocationId: errors.deliveryLocationId,
              earliestDeliveryDate: errors.earliestDeliveryDate,
            }}
          />
        )}

        {isReviewStep && (
          <StepReview
            projectName={selectedProjectName}
            lineItems={lineItems}
            vendors={vendors}
            selectedVendorIds={vendorIds}
            delivery={delivery}
            locations={locations}
          />
        )}

        {isSaveError && (
          <Alert variant="destructive">
            Something went wrong saving your draft. Please try again.
          </Alert>
        )}

        <div className="flex items-center gap-3">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={handleBack} disabled={isSaving}>
              Back
            </Button>
          )}

          {isReviewStep ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleSaveAsDraft()}
                isLoading={isSaving}
                data-testid="save-as-draft"
              >
                Save as draft
              </Button>
              <Button
                type="button"
                onClick={() => setShowSendDialog(true)}
                disabled={isSaving || sendRfq.isPending}
                data-testid="send-to-vendors"
              >
                Send to vendors
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={() => void handleNext()}
              isLoading={isSaving}
              data-testid="next-step"
            >
              Next
            </Button>
          )}
        </div>
      </div>

      {showSendDialog && (
        <SendRfqDialog
          vendorCount={vendorIds.length}
          isSending={sendRfq.isPending}
          isError={sendRfq.isError}
          onCancel={() => setShowSendDialog(false)}
          onSend={(cc) => void handleConfirmSend(cc)}
        />
      )}
    </div>
  );
}
