import type {
  CreatePurchaseOrderInput,
  CreatePoLineItemInput,
  ProjectDetail,
} from '@forethread/api-client';
import { uploadPoDocument } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { notificationService } from '@forethread/ui-components';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';

import { PoSourceOfCreation, PoType } from '@forethread/shared-types/client';

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
  initialValues?: Partial<FormValues>;
  /** Creation mode to set sourceOfCreation on the PO */
  creationMode?: PoCreationMode;
}

export function usePoWizardForm({
  onNavigateBack,
  onCreatePo,
  projectDetail,
  noLineItemsMsg,
  initialValues,
  creationMode = 'manual',
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
          )
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
  }, [step, form, noLineItemsMsg]);

  const handleBack = useCallback(() => {
    if (step > 1) setStep((s) => s - 1);
    else onNavigateBack();
  }, [step, onNavigateBack]);

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
          notes: item.notes || undefined,
          expectedDeliveryDate: item.expectedDeliveryDate
            ? new Date(item.expectedDeliveryDate).toISOString()
            : undefined,
          deliveryLocationId: item.deliveryLocationId || undefined,
        }));

      return {
        documentName: data.documentName || undefined,
        projectId: data.projectId,
        vendorId: data.vendorId || undefined,
        poType: data.holdForRelease ? PoType.HOLD_FOR_RELEASE : PoType.STANDARD,
        sourceOfCreation: CREATION_MODE_TO_SOURCE[creationMode],
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
    [projectDetail],
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
  };
}
