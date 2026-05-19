import { getBulkOrders, getBulkOrder } from '@forethread/api-client';
import type { BulkOrderListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Button,
  Modal,
  ModalIconHeader,
  QueryContainer,
  ItemMeta,
} from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import SearchIcon from '@forethread/ui-components/assets/icons/search.svg?react';
import CoinsIcon from '@forethread/ui-components/assets/icons/coins.svg?react';
import ArrowRightIcon from '@forethread/ui-components/assets/icons/arrow-right.svg?react';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useCallback } from 'react';

import type { FormValues } from '../schemas/create-po.schema';
import { EMPTY_LINE_ITEM } from '../schemas/create-po.schema';
import { formatCurrency, formatDate } from '../utils/format';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BulkOrderCoverageModalProps {
  open: boolean;
  onClose: () => void;
  materialName: string;
  vendorId?: string;
  /** Called when user confirms "No continue" — adds items to current PO */
  onAddItems?: (items: FormValues['lineItems']) => void;
  /** Called when user clicks "Cover" and confirms "Yes, create new PO" */
  onCoverNewPo?: (bulkOrderId: string, lineItemId: string) => void;
  /** Called when items are added to current PO — to suggest vendor update */
  onVendorSuggested?: (vendorId: string) => void;
}

// ── Main Component ──────────────────────────────────────────────────────────

export function BulkOrderCoverageModal({
  open,
  onClose,
  materialName,
  vendorId,
  onAddItems,
  onCoverNewPo,
  onVendorSuggested,
}: BulkOrderCoverageModalProps) {
  const { t } = useTranslation('purchaseOrders');
  const [search, setSearch] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingCover, setPendingCover] = useState<{
    bulkOrderId: string;
    lineItemId: string;
    items: FormValues['lineItems'];
    boVendorId?: string;
  } | null>(null);

  // Fetch bulk orders for this vendor
  const { data: boData, isLoading } = useQuery({
    queryKey: ['bulk-orders', 'coverage', vendorId],
    queryFn: () => getBulkOrders({ ...(vendorId ? { vendorId } : {}), limit: 50 }),
    enabled: open,
  });

  const bulkOrders = boData?.items ?? [];

  const filteredOrders = useMemo(
    () =>
      bulkOrders.filter(
        (bo) =>
          bo.projectName.toLowerCase().includes(search.toLowerCase()) ||
          bo.vendorName.toLowerCase().includes(search.toLowerCase()),
      ),
    [bulkOrders, search],
  );

  const handleCoverClick = useCallback(
    (
      bulkOrderId: string,
      lineItemId: string,
      items: FormValues['lineItems'],
      boVendorId?: string,
    ) => {
      setPendingCover({ bulkOrderId, lineItemId, items, boVendorId });
      setConfirmOpen(true);
    },
    [],
  );

  const handleConfirmContinue = useCallback(() => {
    if (pendingCover) {
      onAddItems?.(pendingCover.items);
      // Suggest updating vendor to match bulk order vendor (AC 11.1)
      if (pendingCover.boVendorId) {
        onVendorSuggested?.(pendingCover.boVendorId);
      }
    }
    setConfirmOpen(false);
    setPendingCover(null);
    onClose();
  }, [pendingCover, onAddItems, onVendorSuggested, onClose]);

  const handleConfirmNewPo = useCallback(() => {
    if (pendingCover) {
      onCoverNewPo?.(pendingCover.bulkOrderId, pendingCover.lineItemId);
    }
    setConfirmOpen(false);
    setPendingCover(null);
    onClose();
  }, [pendingCover, onCoverNewPo, onClose]);

  const handleClose = useCallback(() => {
    setSearch('');
    setConfirmOpen(false);
    setPendingCover(null);
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <>
      <Modal onClose={handleClose} maxWidth="max-w-3xl">
        <div className="p-6 max-h-[80vh] flex flex-col">
          <ModalIconHeader
            icon={<PackageIcon className="w-6 h-6 text-foreground" />}
            title={t('coverageModal.bulkTitle', { material: materialName })}
            subtitle={t('coverageModal.subtitle')}
            onClose={handleClose}
            className="mb-6"
          />

          {/* Content */}
          <div className="rounded-lg border border-border p-4 flex-1 overflow-hidden flex flex-col">
            {/* Search */}
            <div className="relative mb-3">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('coverageModal.searchPlaceholder')}
                className="w-full h-10 rounded-lg border border-border bg-background pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40"
              />
            </div>

            {/* Bulk order list */}
            <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
              <QueryContainer
                isLoading={isLoading}
                isEmpty={filteredOrders.length === 0}
                emptyMessage={t('coverageModal.noOrders')}
                loadingMessage={t('coverageModal.loading')}
              >
                {filteredOrders.map((bo) => (
                  <BulkOrderCoverageCard
                    key={bo.id}
                    bulkOrder={bo}
                    materialName={materialName}
                    onCover={handleCoverClick}
                  />
                ))}
              </QueryContainer>
            </div>
          </div>
        </div>
      </Modal>

      {/* Cover confirmation */}
      {confirmOpen && (
        <CoverConfirmModal
          onContinue={handleConfirmContinue}
          onCreateNewPo={handleConfirmNewPo}
          onClose={() => {
            setConfirmOpen(false);
            setPendingCover(null);
          }}
        />
      )}
    </>
  );
}

// ── Bulk Order Card with expandable line item ───────────────────────────────

interface BulkOrderCoverageCardProps {
  bulkOrder: BulkOrderListItem;
  materialName: string;
  onCover: (
    bulkOrderId: string,
    lineItemId: string,
    items: FormValues['lineItems'],
    boVendorId?: string,
  ) => void;
}

function BulkOrderCoverageCard({ bulkOrder, materialName, onCover }: BulkOrderCoverageCardProps) {
  const { t } = useTranslation('purchaseOrders');

  // Fetch detail to get line items
  const { data: detail } = useQuery({
    queryKey: ['bulk-orders', bulkOrder.id],
    queryFn: () => getBulkOrder(bulkOrder.id),
  });

  const lineItems = detail?.lineItems ?? [];

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
          <PackageIcon className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{bulkOrder.projectName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {bulkOrder.vendorName} / {formatDate(bulkOrder.validUntil)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm">
            <span className="flex items-center gap-1.5">
              {t('coverageModal.reviewOrder')}
              <ArrowRightIcon className="w-4 h-4" />
            </span>
          </Button>
          {lineItems.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const li = lineItems[0];
                const items: FormValues['lineItems'] = [
                  {
                    ...EMPTY_LINE_ITEM,
                    materialName: materialName || li.itemReference,
                    unitOfMeasure: li.unit,
                    unitPrice: li.pricePerUnit,
                    quantityOrdered: li.qtyRemaining,
                    description: li.description ?? '',
                  },
                ];
                onCover(bulkOrder.id, li.lineItemId, items, bulkOrder.vendorId);
              }}
            >
              <span className="flex items-center gap-1.5">
                {t('coverageModal.cover')}
                <CheckCircleIcon className="w-4 h-4" />
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Line items */}
      {lineItems.map((li) => (
        <div key={li.lineItemId} className="rounded-lg border border-border p-3">
          <p className="text-sm font-semibold text-foreground mb-2">{li.itemReference}</p>
          <div className="flex items-center gap-6">
            <ItemMeta
              icon={<CoinsIcon className="w-3.5 h-3.5" />}
              label={t('coverageModal.pricePerUnit')}
              value={formatCurrency(li.pricePerUnit)}
              size="xs"
            />
            <ItemMeta
              icon={<PackageIcon className="w-3.5 h-3.5" />}
              label={t('coverageModal.reservedQty')}
              value={String(li.qtyRemaining)}
              size="xs"
            />
            <ItemMeta
              icon={<CoinsIcon className="w-3.5 h-3.5" />}
              label={t('coverageModal.totalWithTax')}
              value={formatCurrency(li.totalLineInc)}
              size="xs"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Cover Confirm Modal ─────────────────────────────────────────────────────

interface CoverConfirmModalProps {
  onContinue: () => void;
  onCreateNewPo: () => void;
  onClose: () => void;
}

function CoverConfirmModal({ onContinue, onCreateNewPo, onClose }: CoverConfirmModalProps) {
  const { t } = useTranslation('purchaseOrders');

  return (
    <Modal onClose={onClose} maxWidth="max-w-[560px]">
      <div className="p-8 flex flex-col">
        <ModalIconHeader
          icon={<PackageIcon className="w-6 h-6 text-foreground" />}
          title={t('coverageModal.confirmTitle')}
          subtitle={t('coverageModal.confirmSubtitle')}
          onClose={onClose}
          className="mb-8"
        />

        <div className="flex flex-col gap-4">
          <Button variant="primary" size="lg" onClick={onContinue} className="w-full">
            {t('coverageModal.noContinue')}
          </Button>
          <Button variant="outline" size="lg" onClick={onCreateNewPo} className="w-full">
            {t('coverageModal.yesCreateNewPo')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
