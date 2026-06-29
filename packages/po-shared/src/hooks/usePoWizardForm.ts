import type {
  CreatePurchaseOrderInput,
  CreatePoLineItemInput,
  CreatePoChangeRequestInput,
  PoChangedFields,
  PoDetail,
  ProjectDetail,
} from '@forethread/api-client';
import { uploadPoDocument } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { notificationService } from '@forethread/ui-components';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';

import { PoSourceOfCreation, PoType } from '@forethread/shared-types/client';

import { computePoChangedFields, deriveChangeType, hasAnyChange } from '../utils/change-diff';

import {
  formSchema,
  EMPTY_LINE_ITEM,
  EMPTY_DELIVERY_ROW,
  STEP1_FIELDS,
  mapDeliveriesToPayload,
} from '../schemas/create-po.schema';
import type { FormValues, PoCreationMode } from '../schemas/create-po.schema';

const CREATION_MODE_TO_SOURCE: Record<PoCreationMode, string> = {
  manual: PoSourceOfCreation.MANUAL,
  'from-rfq': PoSourceOfCreation.RFQ,
  'from-bulk-order': PoSourceOfCreation.BULK_DRAWDOWN,
};

interface UsePoWizardFormOptions {
  onNavigateBack: () => void;
  onCreatePo: (
    input: CreatePurchaseOrderInput,
    callbacks: { onSuccess: (po: { id: string }) => void; onError: () => void },
  ) => void;
  projectDetail?: ProjectDetail | null;
  noLineItemsMsg: string;
  /** Drawdown (US 5.09): shown when a line's qty exceeds the bulk order remaining qty. */
  drawdownExceedsMsg?: string;
  initialValues?: Partial<FormValues>;
  /** Creation mode to set sourceOfCreation on the PO */
  creationMode?: PoCreationMode;
  /**
   * US 5.09 drawdown: source bulk order id. When set (drawdown mode), it is
   * passed through to the create payload as `bulkOrderId` and each line item's
   * `bulkOrderLineItemId` is forwarded so the backend writes the Drawdown rows
   * and decrements `qtyRemaining`.
   */
  bulkOrderId?: string;
  /**
   * FLOW 3 — wizard mode. `'create'` (default) builds + submits a new PO via
   * `onCreatePo`; `'change'` diffs the edited form against `existingPo` and
   * submits a PO change request via `onProposeChange`.
   */
  mode?: 'create' | 'change';
  /** FLOW 3 change mode: the PO being changed, used to compute the diff. */
  existingPo?: PoDetail;
  /** FLOW 3 change mode: submit the computed change request. */
  onProposeChange?: (
    input: CreatePoChangeRequestInput,
    callbacks: { onSuccess: () => void; onError: () => void },
  ) => void;
  /** FLOW 3 change mode: message shown when there is nothing to submit. */
  noChangesMsg?: string;
}

export function usePoWizardForm({
  onNavigateBack,
  onCreatePo,
  projectDetail,
  noLineItemsMsg,
  drawdownExceedsMsg,
  initialValues,
  creationMode = 'manual',
  bulkOrderId,
  mode = 'create',
  existingPo,
  onProposeChange,
  noChangesMsg,
}: UsePoWizardFormOptions) {
  const { t } = useTranslation('purchaseOrders');
  const [step, setStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);

  const baseDefaults = {
    documentName: '',
    projectId: '',
    vendorId: '',
    paymentTermsDays: undefined as number | undefined,
    deliveryLocationId: '',
    plannedDeliveryDate: '',
    pickUp: false,
    pickUpTimeExpectation: undefined as FormValues['pickUpTimeExpectation'],
    holdForRelease: false,
    lineItems: [{ ...EMPTY_LINE_ITEM }],
    deliveries: [{ ...EMPTY_DELIVERY_ROW }],
    message: '',
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues ? { ...baseDefaults, ...initialValues } : baseDefaults,
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lineItems',
  });

  const {
    fields: deliveryFields,
    append: appendDelivery,
    remove: removeDelivery,
  } = useFieldArray({
    control: form.control,
    name: 'deliveries',
  });

  const watchedLineItems = form.watch('lineItems') ?? [];

  // Drawdown (US 5.09): a line's ordered qty must not exceed the bulk order's
  // remaining qty for that line. Only enforced in drawdown mode (availableQty set).
  const drawdownOverLimit =
    creationMode === 'from-bulk-order' &&
    watchedLineItems.some(
      (li) =>
        li.materialName &&
        li.availableQty != null &&
        Number(li.quantityOrdered) > Number(li.availableQty),
    );

  // Validation gate for Continue button
  const canContinue =
    step === 1
      ? Boolean(
          form.watch('documentName') &&
          form.watch('projectId') &&
          form.watch('deliveryLocationId') &&
          form.watch('plannedDeliveryDate'),
        )
      : step === 2
        ? watchedLineItems.some(
            (li) => li.materialName && li.unitOfMeasure && li.quantityOrdered >= 1,
          ) && !drawdownOverLimit
        : true;

  // Step navigation
  const handleContinue = useCallback(async () => {
    if (step === 1) {
      const valid = await form.trigger([...STEP1_FIELDS]);
      if (valid) setStep(2);
    } else if (step === 2) {
      // Check that at least one filled line item exists (ignore trailing empty row)
      const items = form.getValues('lineItems') ?? [];
      const filledItems = items.filter(
        (li) => li.materialName && li.unitOfMeasure && li.quantityOrdered >= 1,
      );
      if (filledItems.length === 0) {
        notificationService.error(noLineItemsMsg);
        return;
      }
      // Drawdown (US 5.09): block progression if any line exceeds its bulk-order
      // remaining qty (mirrors the backend DRAWDOWN_EXCEEDS_REMAINING 400).
      if (creationMode === 'from-bulk-order') {
        const exceeds = filledItems.some(
          (li) => li.availableQty != null && Number(li.quantityOrdered) > Number(li.availableQty),
        );
        if (exceeds) {
          if (drawdownExceedsMsg) notificationService.error(drawdownExceedsMsg);
          return;
        }
      }
      // Validate filled rows manually — avoid form.trigger per-index which conflicts
      // with zod preprocess on the lineItems array
      let allValid = true;
      for (const item of filledItems) {
        if (!item.materialName || !item.unitOfMeasure || item.quantityOrdered < 1) {
          allValid = false;
          break;
        }
        if (item.unitPrice < 0) {
          allValid = false;
          break;
        }
      }
      if (allValid) setStep(3);
    }
  }, [step, form, noLineItemsMsg, creationMode, drawdownExceedsMsg]);

  const handleBack = useCallback(() => {
    if (step > 1) setStep((s) => s - 1);
    else onNavigateBack();
  }, [step, onNavigateBack]);

  // A drawdown PO is sourced from a bulk order: forces poType DRAWDOWN and
  // carries the bulk order + per-line references the backend draws down against.
  const isDrawdown = creationMode === 'from-bulk-order' && Boolean(bulkOrderId);

  // Build API payload from form data
  const buildPayload = useCallback(
    (data: FormValues): CreatePurchaseOrderInput => {
      const lineItems: CreatePoLineItemInput[] = data.lineItems
        .filter((item) => item.materialName)
        .map((item) => ({
          materialCode: item.materialCode || undefined,
          description: item.materialName || item.description || undefined,
          quantityOrdered: item.quantityOrdered,
          unitOfMeasure: item.unitOfMeasure,
          unitPrice: item.unitPrice,
          costCode: item.costCode || undefined,
          // Catalogue snapshots; default from the material server-side when blank.
          upc: item.upc || undefined,
          manufacturerPartNumber: item.manufacturerPartNumber || undefined,
          taxCode: item.taxCode || undefined,
          notes: item.notes || undefined,
          expectedDeliveryDate: item.expectedDeliveryDate
            ? new Date(item.expectedDeliveryDate).toISOString()
            : undefined,
          deliveryLocationId: item.deliveryLocationId || undefined,
          // Drawdown: link this PO line to its bulk-order line so the backend
          // can decrement qtyRemaining and write the Drawdown row.
          bulkOrderLineItemId: isDrawdown ? item.bulkOrderLineItemId || undefined : undefined,
        }));

      return {
        documentName: data.documentName || undefined,
        projectId: data.projectId,
        vendorId: data.vendorId || undefined,
        // Drawdown POs are forced to DRAWDOWN; otherwise hold-for-release/standard.
        poType: isDrawdown
          ? PoType.DRAWDOWN
          : data.holdForRelease
            ? PoType.HOLD_FOR_RELEASE
            : PoType.STANDARD,
        sourceOfCreation: CREATION_MODE_TO_SOURCE[creationMode],
        bulkOrderId: isDrawdown ? bulkOrderId : undefined,
        currency: projectDetail?.currency ?? 'AUD',
        pickUp: data.pickUp ?? false,
        pickUpTimeExpectation: data.pickUp ? data.pickUpTimeExpectation : undefined,
        holdForRelease: data.holdForRelease ?? false,
        deliveryLocationId: data.deliveryLocationId,
        paymentTermsDays: data.paymentTermsDays ?? undefined,
        plannedDeliveryDate: new Date(data.plannedDeliveryDate).toISOString(),
        deadlineStart: data.plannedDeliveryDate
          ? new Date(data.plannedDeliveryDate).toISOString()
          : undefined,
        message: data.message ?? undefined,
        lineItems,
        deliveries: mapDeliveriesToPayload(data.deliveries),
      };
    },
    [projectDetail, creationMode, isDrawdown, bulkOrderId],
  );

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_EXTENSIONS = [
    'pdf',
    'xlsx',
    'docx',
    'doc',
    'jpg',
    'jpeg',
    'png',
    'webp',
    'svg',
    'csv',
  ];

  const addAttachments = useCallback(
    (files: FileList | File[]) => {
      const newFiles: File[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          notificationService.error(
            t('create.unsupportedFormat', {
              defaultValue: `Unsupported file format: .${ext}`,
            }),
          );
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          notificationService.error(
            t('create.fileTooLarge', {
              defaultValue: `File "${file.name}" exceeds 10 MB limit.`,
            }),
          );
          continue;
        }
        newFiles.push(file);
      }
      if (newFiles.length > 0) {
        setAttachments((prev) => [...prev, ...newFiles]);
      }
    },
    [t],
  );

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const uploadAttachments = useCallback(
    async (poId: string) => {
      if (attachments.length === 0) return;
      try {
        await Promise.all(attachments.map((file) => uploadPoDocument(poId, file)));
      } catch {
        notificationService.error(
          t('create.documentUploadFailed', {
            defaultValue:
              'PO created but some documents failed to upload. You can re-upload from the PO detail page.',
          }),
        );
      }
    },
    [attachments, t],
  );

  const onSubmit = useCallback(
    (data: FormValues) => {
      onCreatePo(buildPayload(data), {
        onSuccess: (po) => {
          void uploadAttachments(po.id).then(() => setShowSuccess(true));
        },
        onError: () => setShowError(true),
      });
    },
    [onCreatePo, buildPayload, uploadAttachments],
  );

  const handleSaveDraft = useCallback(async () => {
    // Validate step 1 fields — required by the backend even for drafts
    const step1Valid = await form.trigger([...STEP1_FIELDS]);
    if (!step1Valid) {
      notificationService.error(
        t('create.draftRequiresStep1', {
          defaultValue: 'Please fill in basic PO information before saving as draft.',
        }),
      );
      return;
    }
    const data = form.getValues();
    onCreatePo(buildPayload(data), {
      onSuccess: (po) => {
        void uploadAttachments(po.id).then(() => setShowSuccess(true));
      },
      onError: () => setShowError(true),
    });
  }, [form, onCreatePo, buildPayload, uploadAttachments, t]);

  // Totals — exclude empty trailing rows
  const filledItems = watchedLineItems.filter((item) => item.materialName);
  const totalItems = filledItems.length;
  const totalQty = filledItems.reduce((sum, item) => sum + (Number(item.quantityOrdered) || 0), 0);
  const subtotal = filledItems.reduce(
    (sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.quantityOrdered) || 0),
    0,
  );

  // FLOW 3 — live diff of the edited form vs the existing PO. Watching the whole
  // form keeps the step-3 review (and the submit gate) in sync as fields change.
  const watchedAll = form.watch();
  const changedFields: PoChangedFields = useMemo(() => {
    if (mode !== 'change' || !existingPo) return {};
    return computePoChangedFields(watchedAll as FormValues, existingPo);
    // watchedAll is a fresh object each render; depend on it + existingPo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, existingPo, JSON.stringify(watchedAll)]);

  // FLOW 3 — submit the computed change request (Step 3 "Submit PO changes").
  const submitChange = useCallback(() => {
    if (!existingPo || !onProposeChange) return;
    const data = form.getValues();
    const diff = computePoChangedFields(data, existingPo);
    if (!hasAnyChange(diff)) {
      if (noChangesMsg) notificationService.error(noChangesMsg);
      return;
    }
    onProposeChange(
      {
        changeType: deriveChangeType(diff),
        changedFields: diff,
        message: data.message || undefined,
      },
      {
        onSuccess: () => setShowSuccess(true),
        onError: () => setShowError(true),
      },
    );
  }, [existingPo, onProposeChange, form, noChangesMsg]);

  return {
    step,
    form,
    fields,
    append,
    remove,
    deliveryFields,
    appendDelivery,
    removeDelivery,
    canContinue,
    handleContinue,
    handleBack,
    onSubmit,
    handleSaveDraft,
    showSuccess,
    setShowSuccess,
    showError,
    setShowError,
    totalItems,
    totalQty,
    subtotal,
    setStep,
    attachments,
    addAttachments,
    removeAttachment,
    // FLOW 3 change mode
    changedFields,
    submitChange,
  };
}
