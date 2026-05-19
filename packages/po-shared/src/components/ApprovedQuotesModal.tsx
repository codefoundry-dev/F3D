import { getRfqs, getRfq } from '@forethread/api-client';
import type { RfqListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Button,
  Modal,
  ModalIconHeader,
  CustomDropdown,
  FiltersButton,
  SearchInput,
  ModalFilterPanel,
  SelectionBar,
} from '@forethread/ui-components';
import BackArrowIcon from '@forethread/ui-components/assets/icons/back-arrow.svg?react';
import CoinsIcon from '@forethread/ui-components/assets/icons/coins.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import TaxIcon from '@forethread/ui-components/assets/icons/tax.svg?react';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useCallback, useEffect } from 'react';

import { useItemSelectionModal } from '../hooks/useItemSelectionModal';
import type { FormValues } from '../schemas/create-po.schema';
import { EMPTY_LINE_ITEM } from '../schemas/create-po.schema';
import type { DerivedQuoteItem } from '../utils/derive-pricing';
import { deriveQuoteLineItems } from '../utils/derive-pricing';
import { formatCurrency } from '../utils/format';

import { MetaField } from './MetaField';
import { ModalItemCard } from './ModalItemCard';
import { ModalListView } from './ModalListView';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Re-export for backward compatibility */
export type QuoteLineItem = DerivedQuoteItem;

type ModalView = 'list' | 'viewQuotes' | 'addItems';

interface ApprovedQuotesModalProps {
  open: boolean;
  onClose: () => void;
  onAddItems: (items: FormValues['lineItems']) => void;
  vendorId?: string;
  /** Material names already in the PO line items table */
  existingMaterialNames?: Set<string>;
}

// ── Main Component ──────────────────────────────────────────────────────────

export function ApprovedQuotesModal({
  open,
  onClose,
  onAddItems,
  vendorId,
  existingMaterialNames = new Set(),
}: ApprovedQuotesModalProps) {
  const { t } = useTranslation('purchaseOrders');
  const [view, setView] = useState<ModalView>('list');
  const [selectedRfq, setSelectedRfq] = useState<RfqListItem | null>(null);
  const sel = useItemSelectionModal();

  // Fetch RFQs with approved quotes
  const { data: rfqsData, isLoading: rfqsLoading } = useQuery({
    queryKey: ['rfqs', 'approved-quotes', vendorId],
    queryFn: () => getRfqs({ minApprovedQuotes: 1, limit: 50 }),
    enabled: open,
  });

  // Fetch selected RFQ detail
  const { data: rfqDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['rfqs', selectedRfq?.id],
    queryFn: () => getRfq(selectedRfq!.id),
    enabled: !!selectedRfq?.id,
  });

  const rfqs = rfqsData?.items ?? [];

  // Filter RFQs by search
  const filteredRfqs = useMemo(
    () =>
      rfqs.filter(
        (rfq) =>
          rfq.id.toLowerCase().includes(sel.search.toLowerCase()) ||
          (rfq.rfqNumber?.toLowerCase().includes(sel.search.toLowerCase()) ?? false) ||
          rfq.projectName.toLowerCase().includes(sel.search.toLowerCase()),
      ),
    [rfqs, sel.search],
  );

  // Derive quote line items from RFQ detail
  const quoteLineItems = useMemo(
    () => (rfqDetail ? deriveQuoteLineItems(rfqDetail) : []),
    [rfqDetail],
  );

  // IDs of quote items whose material already exists in the PO table
  const alreadyInTable = useMemo(
    () =>
      new Set(
        quoteLineItems
          .filter((qi) => existingMaterialNames.has(qi.materialName))
          .map((qi) => qi.id),
      ),
    [quoteLineItems, existingMaterialNames],
  );

  // When entering addItems view and detail loads, pre-select all non-existing items
  useEffect(() => {
    if (view === 'addItems' && quoteLineItems.length > 0) {
      const newIds = new Set(
        quoteLineItems.filter((qi) => !alreadyInTable.has(qi.id)).map((qi) => qi.id),
      );
      sel.initSelectedItems(newIds);
    }
  }, [view, quoteLineItems, alreadyInTable]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unique UoM values for filter dropdown
  const uomOptions = useMemo(
    () =>
      [...new Set(quoteLineItems.map((i) => i.unit))].map((u) => ({
        value: u,
        label: u,
      })),
    [quoteLineItems],
  );

  // Filter quote items by search + UoM filter
  const filteredQuoteItems = useMemo(
    () =>
      quoteLineItems.filter((item) => {
        const matchesSearch =
          item.materialName.toLowerCase().includes(sel.itemSearch.toLowerCase()) ||
          (item.description?.toLowerCase().includes(sel.itemSearch.toLowerCase()) ?? false);
        const matchesUom = !sel.filterUom || item.unit === sel.filterUom;
        return matchesSearch && matchesUom;
      }),
    [quoteLineItems, sel.itemSearch, sel.filterUom],
  );

  const handleViewQuotes = useCallback(
    (rfq: RfqListItem) => {
      setSelectedRfq(rfq);
      setView('viewQuotes');
      sel.resetDetail();
    },
    [sel],
  );

  const handleAddFromRfq = useCallback(
    (rfq: RfqListItem) => {
      setSelectedRfq(rfq);
      setView('addItems');
      sel.resetDetail();
    },
    [sel],
  );

  const handleBack = useCallback(() => {
    setView('list');
    setSelectedRfq(null);
    sel.resetDetail();
  }, [sel]);

  const handleAddSelected = useCallback(() => {
    const items = quoteLineItems
      .filter((qi) => sel.selectedItems.has(qi.id) && !alreadyInTable.has(qi.id))
      .map((qi) => ({
        ...EMPTY_LINE_ITEM,
        materialName: qi.materialName,
        materialCode: '',
        unitOfMeasure: qi.unit,
        unitPrice: qi.unitPrice,
        quantityOrdered: qi.quantity,
        description: qi.description ?? '',
      }));
    if (items.length > 0) onAddItems(items);
    handleClose();
  }, [quoteLineItems, sel.selectedItems, alreadyInTable, onAddItems]);

  const handleClose = useCallback(() => {
    setView('list');
    setSelectedRfq(null);
    sel.resetAll();
    onClose();
  }, [onClose, sel]);

  const handleAddAll = useCallback(() => {
    const items = quoteLineItems
      .filter((qi) => !alreadyInTable.has(qi.id))
      .map((qi) => ({
        ...EMPTY_LINE_ITEM,
        materialName: qi.materialName,
        materialCode: '',
        unitOfMeasure: qi.unit,
        unitPrice: qi.unitPrice,
        quantityOrdered: qi.quantity,
        description: qi.description ?? '',
      }));
    if (items.length > 0) onAddItems(items);
    handleClose();
  }, [quoteLineItems, alreadyInTable, onAddItems, handleClose]);

  const newSelectedCount = [...sel.selectedItems].filter((id) => !alreadyInTable.has(id)).length;

  if (!open) return null;

  return (
    <Modal onClose={handleClose} maxWidth="max-w-2xl">
      <div className="p-6 max-h-[80vh] flex flex-col">
        <ModalIconHeader
          icon={<PackageIcon className="w-6 h-6 text-foreground" />}
          title={t('approvedQuotes.title')}
          subtitle={t('approvedQuotes.subtitle')}
          onClose={handleClose}
          className="mb-6"
        />

        {/* Content */}
        {view === 'list' && (
          <ModalListView
            items={filteredRfqs}
            search={sel.search}
            onSearchChange={sel.setSearch}
            searchPlaceholder={t('approvedQuotes.searchPlaceholder')}
            isLoading={rfqsLoading}
            loadingMessage={t('approvedQuotes.loading')}
            emptyMessage={t('approvedQuotes.noRfqs')}
            onView={handleViewQuotes}
            onAdd={handleAddFromRfq}
            viewTitle={t('approvedQuotes.viewQuotes')}
            addTitle={t('approvedQuotes.addItems')}
            renderInfo={(rfq) => (
              <>
                <p className="text-sm font-medium text-foreground truncate">
                  {rfq.rfqNumber ?? rfq.id}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {rfq.projectName} &middot; {rfq.lineItems} {t('approvedQuotes.items')} &middot;{' '}
                  {rfq.recQuotes} {t('approvedQuotes.quotes')}
                </p>
              </>
            )}
          />
        )}

        {(view === 'viewQuotes' || view === 'addItems') && selectedRfq && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Sub-header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <BackArrowIcon className="w-5 h-5" />
                </button>
                <h3 className="text-base font-semibold text-foreground">
                  {rfqDetail?.name ?? selectedRfq.projectName}
                </h3>
              </div>
              <Button variant="primary" size="lg" onClick={handleAddAll}>
                {t('approvedQuotes.addAllItems', { defaultValue: 'Add all items' })}
              </Button>
            </div>

            {/* Search + Filters container */}
            <div className="rounded-lg border border-border p-4 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <SearchInput
                  value={sel.itemSearch}
                  onChange={(e) => sel.setItemSearch(e.target.value)}
                  placeholder={t('approvedQuotes.searchPlaceholder')}
                  className="flex-1"
                />
                <FiltersButton
                  active={sel.showFilters}
                  onClick={sel.toggleFilters}
                  label={t('approvedQuotes.filters')}
                />
              </div>

              <ModalFilterPanel
                visible={sel.showFilters}
                onClose={sel.toggleFilters}
                title={t('approvedQuotes.filters')}
                clearLabel={t('approvedQuotes.clearFilters')}
                onClear={() => sel.setFilterUom('')}
                showClear={!!sel.filterUom}
              >
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-foreground">
                    {t('approvedQuotes.filterUom')}
                  </label>
                  <CustomDropdown
                    options={uomOptions}
                    value={sel.filterUom}
                    onChange={sel.setFilterUom}
                    placeholder="All UoM"
                  />
                </div>
              </ModalFilterPanel>

              <SelectionBar
                selectedCount={newSelectedCount}
                alreadyInTableCount={alreadyInTable.size}
                onClear={sel.clearSelection}
                onAction={handleAddSelected}
                selectedLabel={t('approvedQuotes.itemsSelected')}
                alreadyInTableLabel={t('approvedQuotes.alreadyAdded', {
                  defaultValue: 'already in PO',
                })}
                actionLabel={t('approvedQuotes.addSelected', { defaultValue: 'Add selected' })}
                clearTitle={t('approvedQuotes.clearSelection', {
                  defaultValue: 'Clear selection',
                })}
              />

              {/* Items list */}
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {detailLoading ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {t('approvedQuotes.loading')}
                  </div>
                ) : filteredQuoteItems.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {t('approvedQuotes.noItems')}
                  </div>
                ) : (
                  filteredQuoteItems.map((item) => (
                    <ModalItemCard
                      key={item.id}
                      id={item.id}
                      name={item.materialName}
                      isSelected={sel.selectedItems.has(item.id)}
                      isInTable={alreadyInTable.has(item.id)}
                      alreadyAddedLabel={t('approvedQuotes.alreadyAdded', {
                        defaultValue: 'already in PO',
                      })}
                      onToggle={sel.toggleItem}
                    >
                      <MetaField
                        icon={<CoinsIcon className="w-3.5 h-3.5" />}
                        label={t('approvedQuotes.pricePerUnit')}
                        value={formatCurrency(item.unitPrice)}
                      />
                      <MetaField
                        icon={<TaxIcon className="w-3.5 h-3.5" />}
                        label={t('approvedQuotes.discount')}
                        value={
                          item.discountPercent > 0
                            ? `${item.discountPercent}%  (${formatCurrency(item.discountAmount)})`
                            : '-'
                        }
                      />
                      <MetaField
                        icon={<PackageIcon className="w-3.5 h-3.5" />}
                        label={t('approvedQuotes.qtyAvailable')}
                        value={`${item.quantity} / ${item.availableQuantity} ${item.unit}`}
                      />
                      <MetaField
                        icon={<CoinsIcon className="w-3.5 h-3.5" />}
                        label={t('approvedQuotes.lineTotalWithTax')}
                        value={formatCurrency(item.lineTotalWithTax)}
                      />
                    </ModalItemCard>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
