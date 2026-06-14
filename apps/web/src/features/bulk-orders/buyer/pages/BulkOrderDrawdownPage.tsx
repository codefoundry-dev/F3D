import { type CreatePurchaseOrderInput } from '@forethread/api-client';
import { useBulkOrder } from '@forethread/bulk-order-shared';
import { useTranslation } from '@forethread/i18n';
import { CreatePoWizard, bulkOrderToFormDefaults } from '@forethread/po-shared';
import { Alert, Spinner } from '@forethread/ui-components';
import { useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import {
  useProjectsList,
  useProjectDetail,
  useCompanyVendors,
  useCreatePurchaseOrder,
} from '@/features/purchase-orders/buyer/services/purchase-orders.service';

/**
 * US 5.09 — Create a drawdown PO from a bulk order.
 *
 * Renders the shared {@link CreatePoWizard} in drawdown ("from-bulk-order")
 * mode. The bulk order detail response exposes human-readable project/vendor
 * names but not their UUIDs, so we resolve those by matching the names against
 * the project list and company vendors before seeding + locking them. Each PO
 * line carries its `bulkOrderLineItemId` + `availableQty` (= `qtyRemaining`) so
 * the backend writes the Drawdown rows and decrements the bulk order on submit.
 */
export default function BulkOrderDrawdownPage() {
  const { t } = useTranslation('purchaseOrders');
  const { id } = useParams<{ id: string }>();
  const bulkOrderId = id ?? '';
  const navigate = useNavigate();

  const { data: bulkOrder, isLoading, isError } = useBulkOrder(bulkOrderId);
  const { data: projectsData } = useProjectsList();
  const { data: vendorsData } = useCompanyVendors();
  const createMutation = useCreatePurchaseOrder();

  // Resolve the bulk order's project/vendor UUIDs from their names so the
  // wizard can prefill + lock them (the detail response only carries names).
  const resolvedProjectId = useMemo(() => {
    if (!bulkOrder || !projectsData) return undefined;
    return projectsData.items.find((p) => p.name === bulkOrder.projectName)?.id;
  }, [bulkOrder, projectsData]);

  const resolvedVendorId = useMemo(() => {
    if (!bulkOrder || !vendorsData) return undefined;
    return vendorsData.find(
      (v) => v.legalName === bulkOrder.vendorName || v.tradeName === bulkOrder.vendorName,
    )?.id;
  }, [bulkOrder, vendorsData]);

  const { data: projectDetail } = useProjectDetail(resolvedProjectId ?? '');

  const { initialValues, lockedFields } = useMemo(() => {
    if (!bulkOrder) return { initialValues: undefined, lockedFields: undefined };
    const { defaultValues, lockedFields: locked } = bulkOrderToFormDefaults(bulkOrder, {
      projectId: resolvedProjectId,
      vendorId: resolvedVendorId,
    });
    return { initialValues: defaultValues, lockedFields: new Set<string>(locked) };
  }, [bulkOrder, resolvedProjectId, resolvedVendorId]);

  const handleCreatePo = useCallback(
    (
      input: CreatePurchaseOrderInput,
      callbacks: { onSuccess: (po: { id: string }) => void; onError: () => void },
    ) => {
      createMutation.mutate(input, {
        onSuccess: (po) => callbacks.onSuccess(po),
        onError: () => callbacks.onError(),
      });
    },
    [createMutation],
  );

  const goToBulkOrder = useCallback(
    () => navigate(ROUTES.bulkOrderDetail.replace(':id', bulkOrderId)),
    [navigate, bulkOrderId],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !bulkOrder) {
    return (
      <div className="p-8">
        <Alert variant="destructive">{t('detail.failedToLoad')}</Alert>
      </div>
    );
  }

  return (
    <CreatePoWizard
      onNavigateBack={goToBulkOrder}
      onSuccess={goToBulkOrder}
      projectsData={projectsData}
      vendorsData={vendorsData}
      projectDetail={projectDetail}
      onProjectIdChange={() => {
        /* projectId is locked in drawdown mode; nothing to track here */
      }}
      onCreatePo={handleCreatePo}
      isCreating={createMutation.isPending}
      initialValues={initialValues}
      lockedFields={lockedFields}
      creationMode="from-bulk-order"
      bulkOrderId={bulkOrderId}
      bulkOrderNumber={bulkOrder.bulkId}
    />
  );
}
