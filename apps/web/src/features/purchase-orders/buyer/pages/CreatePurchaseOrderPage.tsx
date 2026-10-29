import { type CreatePurchaseOrderInput } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { CreatePoWizard, rfqToFormDefaults } from '@forethread/po-shared';
import type { PoCreationMode } from '@forethread/po-shared';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { PageLoader } from '@forethread/ui-components';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import {
  useProjectsList,
  useProjectDetail,
  useCompanyVendors,
  useCreatePurchaseOrder,
  useSourceRfq,
} from '../services/purchase-orders.service';

interface RouteState {
  mode?: PoCreationMode;
  defaultValues?: Record<string, unknown>;
  lockedFields?: string[];
  /**
   * "Start now" from an RFQ's quote review (FOR-391): build the wizard from this
   * quote here, so every line carries the vendor's quoted price.
   */
  rfqSource?: {
    rfqId: string;
    quoteResponseId?: string;
    quoteLineItemIds?: string[];
    projectId?: string;
  };
}

export default function CreatePurchaseOrderPage() {
  const { t } = useTranslation('purchaseOrders');
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as RouteState) ?? {};
  const { rfqSource } = routeState;

  const { data: sourceRfq, isError: sourceRfqError } = useSourceRfq(rfqSource?.rfqId);
  const rfqDefaults = useMemo(
    () =>
      sourceRfq && rfqSource
        ? rfqToFormDefaults(sourceRfq, {
            quoteResponseId: rfqSource.quoteResponseId,
            projectId: rfqSource.projectId,
            quoteLineItemIds: rfqSource.quoteLineItemIds
              ? new Set(rfqSource.quoteLineItemIds)
              : undefined,
          })
        : null,
    [sourceRfq, rfqSource],
  );

  // App-bar breadcrumb: PO Management › Create Purchase Order.
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(t('create.title'), null, ROUTES.purchaseOrders, [
      { label: t('list.title'), to: ROUTES.purchaseOrders },
      { label: t('create.title') },
    ]);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  const { data: projectsData } = useProjectsList();
  const { data: vendorsData } = useCompanyVendors();
  const createMutation = useCreatePurchaseOrder();

  const initialValues: Record<string, unknown> | undefined =
    rfqDefaults?.defaultValues ?? routeState.defaultValues ?? undefined;

  // If the defaults carry a projectId, use it as initial; otherwise empty
  const [projectId, setProjectId] = useState((initialValues?.projectId as string) ?? '');
  useEffect(() => {
    if (rfqDefaults?.defaultValues.projectId) setProjectId(rfqDefaults.defaultValues.projectId);
  }, [rfqDefaults]);
  const { data: projectDetail } = useProjectDetail(projectId);
  // A one-off vendor (FOR-395) is offered only on the project it was added for.
  const projectVendors = useMemo(
    () => vendorsData?.filter((v) => !v.oneOffProjectId || v.oneOffProjectId === projectId),
    [vendorsData, projectId],
  );

  const lockedFields = useMemo(() => {
    if (rfqDefaults) return new Set<string>(rfqDefaults.lockedFields);
    return routeState.lockedFields ? new Set<string>(routeState.lockedFields) : undefined;
  }, [rfqDefaults, routeState.lockedFields]);

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

  // The wizard reads its defaults once, so wait for the source RFQ (if any).
  if (rfqSource && !rfqDefaults && !sourceRfqError) return <PageLoader />;

  return (
    <CreatePoWizard
      onNavigateBack={() => navigate(ROUTES.purchaseOrders)}
      onSuccess={() => navigate(ROUTES.purchaseOrders)}
      projectsData={projectsData}
      vendorsData={projectVendors}
      projectDetail={projectDetail}
      onProjectIdChange={setProjectId}
      onCreatePo={handleCreatePo}
      isCreating={createMutation.isPending}
      initialValues={initialValues}
      lockedFields={lockedFields}
      creationMode={routeState.mode ?? 'manual'}
    />
  );
}
