import { type CreatePoChangeRequestInput } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { CreatePoWizard, poToFormDefaults, usePurchaseOrder } from '@forethread/po-shared';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { Alert, Spinner } from '@forethread/ui-components';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import {
  useProjectsList,
  useProjectDetail,
  useCompanyVendors,
  useProposePoChange,
} from '../services/purchase-orders.service';

/**
 * FLOW 3 — Change a Purchase Order (SPEC FLOW 3 / pc4, pc2, pc3).
 *
 * Renders the shared {@link CreatePoWizard} in change mode: pre-filled from the
 * existing PO, document name locked, 3 steps with the Step-3 diff review. On
 * "Submit PO changes" it proposes a PO change request, then routes back to the
 * PO detail where the new pending CR shows in the "Changes request" tab.
 */
export default function ChangePurchaseOrderPage() {
  const { t } = useTranslation('purchaseOrders');
  const { id } = useParams<{ id: string }>();
  const poId = id ?? '';
  const navigate = useNavigate();
  const setPageTitle = usePageTitleStore((s) => s.setTitle);

  const { data: po, isLoading, isError } = usePurchaseOrder(poId);
  const { data: projectsData } = useProjectsList();
  const { data: vendorsData } = useCompanyVendors();
  const proposeMutation = useProposePoChange(poId);

  // Track the (locked) project so dependent dropdown options resolve.
  const [projectId, setProjectId] = useState('');
  useEffect(() => {
    if (po?.projectId) setProjectId(po.projectId);
  }, [po?.projectId]);
  const { data: projectDetail } = useProjectDetail(projectId);

  useEffect(() => {
    setPageTitle(t('change.title'));
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  const initialValues = useMemo(() => (po ? poToFormDefaults(po).defaultValues : undefined), [po]);

  const goToDetail = useCallback(
    () => navigate(ROUTES.purchaseOrderDetail.replace(':id', poId)),
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
      onNavigateBack={goToDetail}
      onSuccess={goToDetail}
      projectsData={projectsData}
      vendorsData={vendorsData}
      projectDetail={projectDetail}
      onProjectIdChange={setProjectId}
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
