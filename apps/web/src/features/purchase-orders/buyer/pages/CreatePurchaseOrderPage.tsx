import { type CreatePurchaseOrderInput } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { CreatePoWizard } from '@forethread/po-shared';
import type { PoCreationMode } from '@forethread/po-shared';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import {
  useProjectsList,
  useProjectDetail,
  useCompanyVendors,
  useCreatePurchaseOrder,
} from '../services/purchase-orders.service';

interface RouteState {
  mode?: PoCreationMode;
  defaultValues?: Record<string, unknown>;
  lockedFields?: string[];
}

export default function CreatePurchaseOrderPage() {
  const { t } = useTranslation('purchaseOrders');
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as RouteState) ?? {};

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

  // If route state has a projectId, use it as initial; otherwise empty
  const initialProjectId = (routeState.defaultValues?.projectId as string) ?? '';
  const [projectId, setProjectId] = useState(initialProjectId);
  const { data: projectDetail } = useProjectDetail(projectId);

  const initialValues = routeState.defaultValues ?? undefined;
  const lockedFields = useMemo(
    () => (routeState.lockedFields ? new Set<string>(routeState.lockedFields) : undefined),
    [routeState.lockedFields],
  );

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

  return (
    <CreatePoWizard
      onNavigateBack={() => navigate(ROUTES.purchaseOrders)}
      onSuccess={() => navigate(ROUTES.purchaseOrders)}
      projectsData={projectsData}
      vendorsData={vendorsData}
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
