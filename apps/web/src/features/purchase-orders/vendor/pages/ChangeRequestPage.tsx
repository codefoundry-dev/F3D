import {
  type CreatePoChangeRequestInput,
  type ProjectDetail,
  type VendorAssignment,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { CreatePoWizard, poToFormDefaults, usePurchaseOrder } from '@forethread/po-shared';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { Alert, Spinner } from '@forethread/ui-components';
import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { useProposePoChange } from '../services/purchase-orders.service';

/**
 * FLOW 3 (vendor) — propose a change to a Purchase Order.
 *
 * Reuses the shared {@link CreatePoWizard} in change mode (same engine the buyer
 * uses): pre-filled from the existing PO, with a real Step-3 diff review that
 * submits a PO change request via `onProposeChange`. The buyer-owned identity
 * fields (project, vendor, delivery location) are locked so a vendor proposal
 * only touches commercial terms + line items. Their labels are driven from the
 * PO itself — a vendor neither can nor should fetch the buyer's project/vendor
 * lists, and those fields are locked anyway, so the current values are all we
 * need to render.
 */
const VENDOR_LOCKED_FIELDS = new Set<string>(['projectId', 'vendorId', 'deliveryLocationId']);

export default function ChangeRequestPage() {
  const { t } = useTranslation('purchaseOrders');
  const { id } = useParams<{ id: string }>();
  const poId = id ?? '';
  const navigate = useNavigate();
  const setPageTitle = usePageTitleStore((s) => s.setTitle);

  const { data: po, isLoading, isError } = usePurchaseOrder(poId);
  const proposeMutation = useProposePoChange(poId);

  // App-bar breadcrumb: PO Management › <PO number> › Change Request.
  useEffect(() => {
    if (po) {
      setPageTitle(t('change.title'), null, ROUTES.purchaseOrderDetail.replace(':id', po.id), [
        { label: t('list.title'), to: ROUTES.purchaseOrders },
        { label: po.poNumber, to: ROUTES.purchaseOrderDetail.replace(':id', po.id) },
        { label: t('change.title') },
      ]);
    }
    return () => setPageTitle(null);
  }, [po, setPageTitle, t]);

  const initialValues = useMemo(() => (po ? poToFormDefaults(po).defaultValues : undefined), [po]);

  // Drive the wizard's locked dropdowns from the PO itself (no extra API calls).
  const projectsData = useMemo(
    () => (po ? { items: [{ id: po.projectId, name: po.projectName }] } : undefined),
    [po],
  );
  const vendorsData = useMemo(
    () =>
      po?.vendor
        ? ([{ id: po.vendor.id, legalName: po.vendor.name }] as unknown as VendorAssignment[])
        : undefined,
    [po],
  );
  const projectDetail = useMemo(
    () =>
      po?.deliveryLocationId
        ? ({
            locations: [
              {
                id: po.deliveryLocationId,
                label: po.deliveryLocationName ?? '',
                address: po.deliveryLocationName ?? '',
                type: 'DELIVERY',
              },
            ],
          } as unknown as ProjectDetail)
        : null,
    [po],
  );

  const goToDetail = useCallback(
    () => void navigate(ROUTES.purchaseOrderDetail.replace(':id', poId)),
    [navigate, poId],
  );

  const handleProposeChange = useCallback(
    (
      input: CreatePoChangeRequestInput,
      callbacks: { onSuccess: () => void; onError: () => void },
    ) => {
      proposeMutation.mutate(input, {
        onSuccess: () => callbacks.onSuccess(),
        onError: () => callbacks.onError(),
      });
    },
    [proposeMutation],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !po) {
    return (
      <div className="p-8">
        <Alert variant="destructive">{t('detail.failedToLoad')}</Alert>
      </div>
    );
  }

  return (
    <CreatePoWizard
      mode="change"
      existingPo={po}
      lockedFields={VENDOR_LOCKED_FIELDS}
      onNavigateBack={goToDetail}
      onSuccess={goToDetail}
      projectsData={projectsData}
      vendorsData={vendorsData}
      projectDetail={projectDetail}
      onProjectIdChange={() => {
        /* project is locked in vendor change mode — nothing to sync */
      }}
      onCreatePo={() => {
        /* unused in change mode — changes go through onProposeChange */
      }}
      isCreating={false}
      onProposeChange={handleProposeChange}
      isSubmittingChange={proposeMutation.isPending}
      initialValues={initialValues}
    />
  );
}
