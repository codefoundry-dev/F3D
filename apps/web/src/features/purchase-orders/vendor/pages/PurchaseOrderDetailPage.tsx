import {
  exportPurchaseOrders,
  getVendorProfile,
  type VendorAcceptPoInput,
  type WarehouseLocation,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  usePurchaseOrder,
  PoDetailTabs,
  PoDetailsTab,
  PoLineItemsTab,
  PoDocumentsTab,
  PoMessagesTab,
  PoActionLogTab,
} from '@forethread/po-shared';
import type { PoTab, RelatedDocument } from '@forethread/po-shared';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { Button, Spinner } from '@forethread/ui-components';
import ChevronDownIcon from '@forethread/ui-components/assets/icons/chevron-down.svg?react';
import DownloadIcon from '@forethread/ui-components/assets/icons/download.svg?react';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useAuthStore } from '@/features/auth/state/auth.store';
import { usePermissions } from '@/shared/role/usePermissions';

import { PoVendorAcceptFields } from '../components/PoVendorAcceptFields';
import { PoVendorActions } from '../components/PoVendorActions';

const VENDOR_TABS: PoTab[] = ['details', 'lineItems', 'messages', 'documents', 'actionLog'];
const ACTIONABLE_STATUSES = ['SENT', 'ACKNOWLEDGED'];

export default function PurchaseOrderDetailPage() {
  const { t } = useTranslation('purchaseOrders');
  const { id } = useParams<{ id: string }>();
  const { data: po, isLoading, isError } = usePurchaseOrder(id ?? '');
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const { has } = usePermissions();
  const setPageTitle = usePageTitleStore((s) => s.setTitle);

  useEffect(() => {
    if (po) setPageTitle(po.poNumber);
    return () => setPageTitle(null);
  }, [po, setPageTitle]);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as PoTab | null;
  const activeTab: PoTab = tabParam && VENDOR_TABS.includes(tabParam) ? tabParam : 'details';

  const setActiveTab = useCallback(
    (tab: PoTab) => setSearchParams({ tab }, { replace: true }),
    [setSearchParams],
  );

  // Editable vendor accept fields — persist across page reloads via localStorage
  const storageKey = id ? `po-accept-${id}` : null;

  const [paymentTermsDays, setPaymentTermsDays] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { paymentTermsDays?: string };
        if (parsed.paymentTermsDays) return parsed.paymentTermsDays;
      }
    }
    return '';
  });

  const [warehouseLocationId, setWarehouseLocationId] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { warehouseLocationId?: string };
        if (parsed.warehouseLocationId) return parsed.warehouseLocationId;
      }
    }
    return '';
  });

  // Initialize payment terms from PO data (only if no saved value)
  useEffect(() => {
    if (po?.paymentTermsDays !== null && po?.paymentTermsDays !== undefined) {
      setPaymentTermsDays((prev) => prev || String(po.paymentTermsDays));
    }
  }, [po?.paymentTermsDays]);

  // Persist to localStorage on change
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify({ paymentTermsDays, warehouseLocationId }));
    }
  }, [storageKey, paymentTermsDays, warehouseLocationId]);

  // Fetch warehouse locations for vendor
  const { data: vendorProfile } = useQuery({
    queryKey: ['vendor-profile', po?.vendor?.id],
    queryFn: () => getVendorProfile(po?.vendor?.id ?? ''),
    enabled: !!po?.vendor?.id,
  });

  const warehouseLocations: WarehouseLocation[] = vendorProfile?.warehouseLocations ?? [];

  // Build accept input from editable fields
  const acceptInput = useMemo<VendorAcceptPoInput | undefined>(() => {
    const input: VendorAcceptPoInput = {};
    const parsedDays = parseInt(paymentTermsDays, 10);
    if (!isNaN(parsedDays) && parsedDays > 0) input.paymentTermsDays = parsedDays;
    if (warehouseLocationId) input.warehouseLocationId = warehouseLocationId;
    return Object.keys(input).length > 0 ? input : undefined;
  }, [paymentTermsDays, warehouseLocationId]);

  // Placeholder action log data (will be replaced when API available)
  const actionLogs = useMemo(() => {
    if (!po) return [];
    const logs = [];
    if (po.createdAt) {
      logs.push({
        id: 'created',
        action: 'Purchase Order Created',
        description: `Created by ${po.createdBy.name}`,
        performedBy: po.createdBy,
        createdAt: po.createdAt,
      });
    }
    if (po.issuedAt) {
      logs.push({
        id: 'issued',
        action: 'Purchase Order Issued',
        description: `Issued to ${po.vendor?.name ?? 'vendor'}`,
        performedBy: po.createdBy,
        createdAt: po.issuedAt,
      });
    }
    if (po.status === 'ACKNOWLEDGED' || po.status === 'ACCEPTED') {
      logs.push({
        id: 'acknowledged',
        action: 'Purchase Order Acknowledged',
        description: `Acknowledged by vendor`,
        performedBy: po.vendor ? { id: po.vendor.id, name: po.vendor.name } : po.createdBy,
        createdAt: po.updatedAt,
      });
    }
    return logs;
  }, [po]);

  // Build related documents from PO references (RFQ, Invoices)
  const relatedDocuments = useMemo((): RelatedDocument[] => {
    if (!po) return [];
    const docs: RelatedDocument[] = [];
    if (po.rfqId) {
      docs.push({ id: `rfq-${po.rfqId}`, label: String(po.rfqId), url: `/rfqs/${po.rfqId}` });
    }
    for (const inv of (po.invoices ?? []) as Array<{
      id: string;
      status: string;
      totalAmount: number;
    }>) {
      docs.push({ id: `inv-${inv.id}`, label: String(inv.id), url: `/invoices/${inv.id}` });
    }
    return docs;
  }, [po]);

  const isActionable = po ? ACTIONABLE_STATUSES.includes(po.status) : false;

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !po) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">{t('detail.noData')}</div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Vendor action banner + buttons */}
      <div className="px-4 md:px-8 pt-4 md:pt-6">
        <div className="flex items-start justify-between gap-4">
          {isActionable && (
            <div className="flex-1">
              <PoVendorActions po={po} acceptInput={acceptInput} />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 md:px-8 pt-4 md:pt-3 pb-3 md:pb-4">
        <PoDetailTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={VENDOR_TABS}
          rightSlot={
            <div className="flex gap-3 items-center">
              {activeTab === 'details' && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<DownloadIcon className="w-4 h-4" />}
                  onClick={() => {
                    void exportPurchaseOrders('pdf', { search: po.id }).then(({ url }) =>
                      window.open(url, '_blank'),
                    );
                  }}
                >
                  {t('actions.exportAs')}
                </Button>
              )}
              {isActionable && activeTab === 'details' && (
                <Button
                  variant="outline"
                  size="sm"
                  rightIcon={<ChevronDownIcon className="w-4 h-4" />}
                  onClick={() =>
                    navigate(`${ROUTES.purchaseOrderChangeRequest.replace(':id', po.id)}`)
                  }
                >
                  {t('actions.changeRequest')}
                </Button>
              )}
            </div>
          }
        />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-6 md:pb-8">
        {activeTab === 'details' && (
          <PoDetailsTab
            po={po}
            layout="page"
            isVendorView
            vendorAcceptSlot={
              isActionable ? (
                <PoVendorAcceptFields
                  paymentTermsDays={paymentTermsDays}
                  onPaymentTermsChange={setPaymentTermsDays}
                  warehouseLocationId={warehouseLocationId}
                  onWarehouseChange={setWarehouseLocationId}
                  warehouseLocations={warehouseLocations}
                />
              ) : undefined
            }
          />
        )}
        {activeTab === 'lineItems' && (
          <PoLineItemsTab
            poId={po.id}
            lineItems={po.lineItems ?? []}
            layout="page"
            onEditAll={() => navigate(`${ROUTES.purchaseOrderChangeRequest.replace(':id', po.id)}`)}
          />
        )}
        {activeTab === 'documents' && (
          <PoDocumentsTab
            poId={po.id}
            documents={po.documents ?? []}
            hideUpload={!has('po.uploadDocument')}
            relatedDocuments={relatedDocuments}
          />
        )}
        {activeTab === 'messages' && (
          <PoMessagesTab
            poId={po.id}
            poStatus={po.status}
            currentUserId={currentUser?.id}
            creatorUserId={po.createdBy.id}
          />
        )}
        {activeTab === 'actionLog' && <PoActionLogTab logs={actionLogs} />}
      </div>
    </div>
  );
}
