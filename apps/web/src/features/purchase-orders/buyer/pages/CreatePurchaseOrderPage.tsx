import { type CreatePurchaseOrderInput } from '@forethread/api-client';
import { CreatePoWizard } from '@forethread/po-shared';
import type { PoCreationMode } from '@forethread/po-shared';
import { useCallback, useMemo, useState } from 'react';
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
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as RouteState) ?? {};

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
