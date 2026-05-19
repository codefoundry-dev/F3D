import { getRfqs, getRfq } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Badge,
  Button,
  Modal,
  ModalIconHeader,
  QueryContainer,
  ItemMeta,
} from '@forethread/ui-components';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import CoinsIcon from '@forethread/ui-components/assets/icons/coins.svg?react';
import TaxIcon from '@forethread/ui-components/assets/icons/tax.svg?react';
import DateIcon from '@forethread/ui-components/assets/icons/date.svg?react';
import ArrowRightIcon from '@forethread/ui-components/assets/icons/arrow-right.svg?react';
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';

import type { FormValues } from '../schemas/create-po.schema';
import { EMPTY_LINE_ITEM } from '../schemas/create-po.schema';
import { formatCurrency, formatDate } from '../utils/format';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RfqCoverageModalProps {
  open: boolean;
  onClose: () => void;
  materialName: string;
  vendorId?: string;
  /** Called when "Add to PO" confirmed with "No continue" */
  onAddToPo?: (items: FormValues['lineItems']) => void;
  /** Called when "Yes, create new PO" */
  onCreateNewPo?: () => void;
  /** Called when items are added to current PO — to suggest vendor update */
  onVendorSuggested?: (vendorId: string) => void;
}

// ── Main Component ──────────────────────────────────────────────────────────

export function RfqCoverageModal({
  open,
  onClose,
  materialName,
  vendorId,
  onAddToPo,
  onCreateNewPo,
  onVendorSuggested,
}: RfqCoverageModalProps) {
  const { t } = useTranslation('purchaseOrders');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingItems, setPendingItems] = useState<{
    items: FormValues['lineItems'];
    rfqVendorId?: string;
  } | null>(null);

  // Fetch RFQs with approved quotes
  const { data: rfqsData, isLoading } = useQuery({
    queryKey: ['rfqs', 'coverage', vendorId, materialName],
    queryFn: () => getRfqs({ minApprovedQuotes: 1, limit: 50 }),
    enabled: open,
  });

  const rfqs = rfqsData?.items ?? [];

  const handleAddToPo = useCallback((items: FormValues['lineItems'], rfqVendorId?: string) => {
    setPendingItems({ items, rfqVendorId });
    setConfirmOpen(true);
  }, []);

  const handleConfirmContinue = useCallback(() => {
    if (pendingItems) {
      onAddToPo?.(pendingItems.items);
      // Suggest updating vendor to match RFQ vendor (AC 11.2)
      if (pendingItems.rfqVendorId) {
        onVendorSuggested?.(pendingItems.rfqVendorId);
      }
    }
    setConfirmOpen(false);
    setPendingItems(null);
    onClose();
  }, [pendingItems, onAddToPo, onVendorSuggested, onClose]);

  const handleConfirmNewPo = useCallback(() => {
    onCreateNewPo?.();
    setConfirmOpen(false);
    setPendingItems(null);
    onClose();
  }, [onCreateNewPo, onClose]);

  const handleClose = useCallback(() => {
    setConfirmOpen(false);
    setPendingItems(null);
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <>
      <Modal onClose={handleClose} maxWidth="max-w-3xl">
        <div className="p-6 max-h-[80vh] flex flex-col">
          <ModalIconHeader
            icon={<PackageIcon className="w-6 h-6 text-foreground" />}
            title={t('coverageModal.rfqTitle', { material: materialName })}
            subtitle={t('coverageModal.subtitle')}
            onClose={handleClose}
            className="mb-6"
          />

          <div className="rounded-lg border border-border p-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              <QueryContainer
                isLoading={isLoading}
                isEmpty={rfqs.length === 0}
                emptyMessage={t('coverageModal.noQuotes')}
                loadingMessage={t('coverageModal.loading')}
              >
                {rfqs.map((rfq) => (
                  <RfqQuoteCard
                    key={rfq.id}
                    rfqId={rfq.id}
                    rfqName={rfq.projectName}
                    materialName={materialName}
                    onAddToPo={handleAddToPo}
                  />
                ))}
              </QueryContainer>
            </div>
          </div>
        </div>
      </Modal>

      {confirmOpen && (
        <RfqConfirmModal
          onContinue={handleConfirmContinue}
          onCreateNewPo={handleConfirmNewPo}
          onClose={() => {
            setConfirmOpen(false);
            setPendingItems(null);
          }}
        />
      )}
    </>
  );
}

// ── Quote Card ──────────────────────────────────────────────────────────────

interface RfqQuoteCardProps {
  rfqId: string;
  rfqName: string;
  materialName: string;
  onAddToPo: (items: FormValues['lineItems'], rfqVendorId?: string) => void;
}

function RfqQuoteCard({ rfqId, rfqName, materialName, onAddToPo }: RfqQuoteCardProps) {
  const { t } = useTranslation('purchaseOrders');

  const { data: detail } = useQuery({
    queryKey: ['rfqs', rfqId],
    queryFn: () => getRfq(rfqId),
  });

  const approvedResponses =
    detail?.quoteResponses.filter((qr) => qr.status === 'APPROVED' || qr.status === 'Approved') ??
    [];

  if (approvedResponses.length === 0 && detail) return null;

  return (
    <>
      {approvedResponses.map((qr) => {
        const discountText = qr.discountPercent
          ? `${qr.discountPercent}%  (${formatCurrency(qr.discountAmount ?? 0)})`
          : '-';
        const coverageText = `${qr.itemsCovered} items`;

        return (
          <div key={qr.id} className="rounded-lg border border-border p-3 space-y-2">
            {/* Header: vendor name + badge + RFQ ID */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{qr.vendorName}</span>
                <Badge className="bg-[#e4e4e4] text-[#262626] border-0 rounded-full text-xs px-2 py-0.5">
                  Delivery
                </Badge>
              </div>
              <span className="text-sm font-semibold text-foreground">{rfqName}</span>
            </div>

            {/* Metadata */}
            <div className="flex flex-wrap items-start gap-4 py-1">
              <ItemMeta
                icon={<CoinsIcon className="w-4 h-4" />}
                label={t('coverageModal.pricePerUnit')}
                value={formatCurrency(qr.totalCost / (qr.itemsCovered || 1))}
                size="xs"
                className="w-[140px]"
              />
              <ItemMeta
                icon={<TaxIcon className="w-4 h-4" />}
                label="Discount"
                value={discountText}
                size="xs"
                className="w-[140px]"
              />
              <ItemMeta
                icon={<PackageIcon className="w-4 h-4" />}
                label="Approved QTY"
                value={coverageText}
                size="xs"
                className="w-[140px]"
              />
              <ItemMeta
                icon={<CoinsIcon className="w-4 h-4" />}
                label={t('coverageModal.totalWithTax')}
                value={formatCurrency(qr.totalCost)}
                size="xs"
                className="w-[140px]"
              />
              <ItemMeta
                icon={<DateIcon className="w-4 h-4" />}
                label="Delivery date:"
                value={formatDate(qr.submittedAt)}
                size="xs"
                className="w-[140px]"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(`/rfqs/${rfqId}/quotes/${qr.id}?tab=lineItems`, '_blank')
                }
              >
                <span className="flex items-center gap-1.5">
                  {t('coverageModal.reviewQuote', { defaultValue: 'Review quote' })}
                  <ArrowRightIcon className="w-4 h-4" />
                </span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const unitPrice = qr.totalCost / (qr.itemsCovered || 1);
                  const items: FormValues['lineItems'] = [
                    {
                      ...EMPTY_LINE_ITEM,
                      materialName,
                      unitOfMeasure: '',
                      unitPrice,
                      quantityOrdered: qr.itemsCovered || 1,
                      description: `From RFQ: ${rfqName}`,
                    },
                  ];
                  onAddToPo(items, qr.vendorId);
                }}
              >
                {t('coverageModal.addToPo', { defaultValue: 'Add to PO' })}
              </Button>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ── Confirm Modal (different vendor warning) ────────────────────────────────

interface RfqConfirmModalProps {
  onContinue: () => void;
  onCreateNewPo: () => void;
  onClose: () => void;
}

function RfqConfirmModal({ onContinue, onCreateNewPo, onClose }: RfqConfirmModalProps) {
  const { t } = useTranslation('purchaseOrders');

  return (
    <Modal onClose={onClose} maxWidth="max-w-[560px]">
      <div className="p-8 flex flex-col">
        <ModalIconHeader
          icon={<PackageIcon className="w-6 h-6 text-foreground" />}
          title={t('coverageModal.rfqConfirmTitle', {
            defaultValue:
              'This is not chosen vendor. Do you want to create new PO or continue with this?',
          })}
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
