import { getRfqs, getRfq } from '@forethread/api-client';
import type { RfqListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Button,
  Modal,
  ModalGridBackground,
  ModalIconHeader,
  CustomDropdown,
  QueryContainer,
  ItemMeta,
  FiltersButton,
  SearchInput,
  ModalFilterPanel,
  SelectionBar,
} from '@forethread/ui-components';
import ArrowRightIcon from '@forethread/ui-components/assets/icons/arrow-right.svg?react';
import BackArrowIcon from '@forethread/ui-components/assets/icons/back-arrow.svg?react';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import CoinsIcon from '@forethread/ui-components/assets/icons/coins.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import DateIcon from '@forethread/ui-components/assets/icons/date.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import PlusInCircleIcon from '@forethread/ui-components/assets/icons/plus-in-circle.svg?react';
import TaxIcon from '@forethread/ui-components/assets/icons/tax.svg?react';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useCallback, useEffect } from 'react';

import { useItemSelectionModal } from '../hooks/useItemSelectionModal';
import type { DerivedQuoteItem } from '../utils/derive-pricing';
import { deriveVendorGroups } from '../utils/derive-pricing';
import { formatCurrency, formatDate } from '../utils/format';

// ── Types ─────────────────────────────────────────────────────────────────────

type ModalView = 'list' | 'detail';

interface SelectRfqModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (rfq: RfqListItem, selectedItemIds?: Set<string>) => void;
}

// ── Main Component ──────────────────────────────────────────────────────────

export function SelectRfqModal({ open, onClose, onSelect }: SelectRfqModalProps) {
  const { t } = useTranslation('purchaseOrders');
  const [view, setView] = useState<ModalView>('list');
  const [selectedRfq, setSelectedRfq] = useState<RfqListItem | null>(null);
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());
  const sel = useItemSelectionModal();

  const { data, isLoading } = useQuery({
    queryKey: ['rfqs', 'select-for-po'],
    queryFn: () => getRfqs({ minApprovedQuotes: 1, limit: 50 }),
    enabled: open,
  });

  const { data: rfqDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['rfqs', selectedRfq?.id],
    queryFn: () => getRfq(selectedRfq!.id),
    enabled: !!selectedRfq?.id,
  });

  const rfqs = data?.items ?? [];

  const filtered = useMemo(
    () =>
      rfqs.filter(
        (r) =>
          r.projectName.toLowerCase().includes(sel.search.toLowerCase()) ||
          (r.rfqNumber?.toLowerCase().includes(sel.search.toLowerCase()) ?? false) ||
          r.id.toLowerCase().includes(sel.search.toLowerCase()),
      ),
    [rfqs, sel.search],
  );

  const vendorGroups = useMemo(() => (rfqDetail ? deriveVendorGroups(rfqDetail) : []), [rfqDetail]);

  const allItems = useMemo(() => vendorGroups.flatMap((vg) => vg.items), [vendorGroups]);

  const filterItem = useCallback(
    (item: DerivedQuoteItem) => {
      const matchesSearch =
        item.materialName.toLowerCase().includes(sel.itemSearch.toLowerCase()) ||
        (item.description?.toLowerCase().includes(sel.itemSearch.toLowerCase()) ?? false);
      const matchesUom = !sel.filterUom || item.unit === sel.filterUom;
      return matchesSearch && matchesUom;
    },
    [sel.itemSearch, sel.filterUom],
  );

  const uomOptions = useMemo(
    () => [...new Set(allItems.map((i) => i.unit))].map((u) => ({ value: u, label: u })),
    [allItems],
  );

  // Expand first vendor by default when entering detail
  useEffect(() => {
    if (view === 'detail' && vendorGroups.length > 0) {
      setExpandedVendors(new Set([vendorGroups[0].vendorName]));
    }
  }, [view, vendorGroups.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewItems = useCallback(
    (rfq: RfqListItem) => {
      setSelectedRfq(rfq);
      setView('detail');
      sel.resetDetail();
      setExpandedVendors(new Set());
    },
    [sel],
  );

  const handleBack = useCallback(() => {
    setView('list');
    setSelectedRfq(null);
    sel.resetDetail();
    setExpandedVendors(new Set());
  }, [sel]);

  const handleClose = useCallback(() => {
    setView('list');
    setSelectedRfq(null);
    sel.resetAll();
    setExpandedVendors(new Set());
    onClose();
  }, [onClose, sel]);

  const handleAddAll = useCallback(() => {
    if (selectedRfq) onSelect(selectedRfq);
  }, [selectedRfq, onSelect]);

  const handleAddSelected = useCallback(() => {
    if (selectedRfq && sel.selectedItems.size > 0) {
      // Map composite IDs back to original line item IDs
      const originalIds = new Set(
        allItems.filter((i) => sel.selectedItems.has(i.id)).map((i) => i.lineItemId),
      );
      onSelect(selectedRfq, originalIds);
    }
  }, [selectedRfq, sel.selectedItems, allItems, onSelect]);

  const toggleVendor = useCallback((vendorName: string) => {
    setExpandedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(vendorName)) next.delete(vendorName);
      else next.add(vendorName);
      return next;
    });
  }, []);

  const selectAllVendorItems = useCallback(
    (items: DerivedQuoteItem[]) => {
      const ids = items.map((i) => i.id);
      sel.initSelectedItems(new Set([...sel.selectedItems, ...ids]));
    },
    [sel],
  );

  const deselectAllVendorItems = useCallback(
    (items: DerivedQuoteItem[]) => {
      const idsToRemove = new Set(items.map((i) => i.id));
      sel.initSelectedItems(new Set([...sel.selectedItems].filter((id) => !idsToRemove.has(id))));
    },
    [sel],
  );

  if (!open) return null;

  return (
    <Modal onClose={handleClose} maxWidth="max-w-[1024px]" decoration={<ModalGridBackground />}>
      <div className="relative p-8 max-h-[80vh] flex flex-col">
        <ModalIconHeader
          icon={<CheckCircleIcon className="w-6 h-6 text-foreground" />}
          title={t('selectRfqModal.title')}
          subtitle={t('selectRfqModal.subtitle')}
          onClose={handleClose}
          className="mb-10"
        />

        {view === 'list' ? (
          /* ── List View ─────────────────────────────────────────── */
          <div className="rounded-xl border border-border p-4 flex-1 overflow-hidden flex flex-col">
            <SearchInput
              value={sel.search}
              onChange={(e) => sel.setSearch(e.target.value)}
              placeholder={t('selectRfqModal.searchPlaceholder')}
              className="mb-3"
            />

            <div className="flex-1 overflow-y-auto space-y-1 min-h-0 max-h-[356px]">
              <QueryContainer
                isLoading={isLoading}
                isEmpty={filtered.length === 0}
                emptyMessage={t('selectRfqModal.noRfqs')}
              >
                {filtered.map((rfq) => (
                  <div
                    key={rfq.id}
                    className="flex items-center gap-3 w-full rounded-lg border border-border p-3 hover:border-border-hover transition-colors cursor-pointer"
                    onClick={() => onSelect(rfq)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onSelect(rfq);
                    }}
                  >
                    <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <PackageIcon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate leading-5">
                        {rfq.rfqNumber ?? rfq.id}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground leading-4">
                        <span>
                          {t('selectRfqModal.created')} {formatDate(rfq.createdDate)}
                        </span>
                        <span>{rfq.createdBy}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewItems(rfq);
                      }}
                      title={t('approvedQuotes.viewQuotes')}
                    >
                      <EyeIcon className="w-6 h-6" />
                    </button>
                  </div>
                ))}
              </QueryContainer>
            </div>
          </div>
        ) : (
          /* ── Detail View ───────────────────────────────────────── */
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Sub-header: back + RFQ name + Add all items */}
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={handleBack}
                className="p-1 text-foreground hover:text-foreground/70 transition-colors shrink-0"
              >
                <BackArrowIcon className="w-6 h-6" />
              </button>
              <h3 className="flex-1 text-[22px] font-medium text-foreground min-w-0 truncate">
                {rfqDetail?.name ?? selectedRfq?.rfqNumber ?? selectedRfq?.id}
              </h3>
              <Button variant="primary" size="lg" onClick={handleAddAll}>
                {t('selectRfqModal.addAllItems')}
                <ArrowRightIcon className="w-6 h-6" />
              </Button>
            </div>

            {/* Card with search + filters + items */}
            <div className="rounded-xl border border-border p-4 flex-1 overflow-hidden flex flex-col">
              {/* Search + Filters */}
              <div className="flex items-center gap-10 mb-3">
                <SearchInput
                  value={sel.itemSearch}
                  onChange={(e) => sel.setItemSearch(e.target.value)}
                  placeholder={t('selectRfqModal.searchPlaceholder')}
                  className="flex-1"
                />
                <FiltersButton
                  active={sel.showFilters}
                  onClick={sel.toggleFilters}
                  label={t('approvedQuotes.filters')}
                />
              </div>

              {/* Filter panel */}
              <ModalFilterPanel
                visible={sel.showFilters}
                onClose={sel.toggleFilters}
                title={t('approvedQuotes.filters')}
                clearLabel={t('approvedQuotes.clearFilters')}
                onClear={() => sel.setFilterUom('')}
                showClear={!!sel.filterUom}
                className="mb-3"
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

              {/* Selection counter */}
              <SelectionBar
                selectedCount={sel.selectedItems.size}
                onClear={sel.clearSelection}
                onAction={handleAddSelected}
                selectedLabel={t('selectRfqModal.itemsSelected')}
                actionLabel={`${t('selectRfqModal.addItems', { defaultValue: 'Add items' })} (${sel.selectedItems.size})`}
                clearTitle={t('selectRfqModal.clearSelection', {
                  defaultValue: 'Clear selection',
                })}
              />

              {/* Vendor-grouped items */}
              <div className="flex-1 overflow-y-auto min-h-0 max-h-[356px]">
                <QueryContainer
                  isLoading={detailLoading}
                  isEmpty={vendorGroups.length === 0}
                  emptyMessage={t('approvedQuotes.noItems')}
                >
                  {vendorGroups.map((vg) => {
                    const visibleItems = vg.items.filter(filterItem);
                    if (visibleItems.length === 0) return null;
                    const isExpanded = expandedVendors.has(vg.vendorName);

                    return (
                      <div
                        key={vg.vendorName}
                        className="flex flex-col items-start self-stretch rounded-[12px] border border-border overflow-hidden mb-2"
                      >
                        {/* Vendor accordion header */}
                        <div className="flex items-center justify-between w-full py-3 px-3 bg-border">
                          <button
                            type="button"
                            className="flex items-center gap-2 text-sm font-medium text-foreground"
                            onClick={() => toggleVendor(vg.vendorName)}
                          >
                            <ChevronRightIcon
                              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            />
                            <span>{vg.vendorName}</span>
                            <span className="text-muted-foreground font-normal ml-1">
                              {visibleItems.length}/{vg.items.length} (
                              {t('selectRfqModal.approvedItemsFromRfq')})
                            </span>
                          </button>
                          {(() => {
                            const allVendorSelected =
                              visibleItems.length > 0 &&
                              visibleItems.every((i) => sel.selectedItems.has(i.id));
                            return (
                              <button
                                type="button"
                                className="flex items-center justify-center gap-1.5 h-8 px-3 py-2 rounded-[12px] border border-foreground text-sm font-medium text-foreground hover:bg-accent transition-colors"
                                onClick={() =>
                                  allVendorSelected
                                    ? deselectAllVendorItems(visibleItems)
                                    : selectAllVendorItems(visibleItems)
                                }
                              >
                                {allVendorSelected ? (
                                  <CrossInCircleIcon className="w-4 h-4" />
                                ) : (
                                  <PlusInCircleIcon className="w-4 h-4" />
                                )}
                                {allVendorSelected
                                  ? t('selectRfqModal.deselectAll', {
                                      defaultValue: 'Deselect all',
                                    })
                                  : t('selectRfqModal.selectAll')}
                              </button>
                            );
                          })()}
                        </div>

                        {/* Items inside the accordion border */}
                        {isExpanded && (
                          <div className="w-full space-y-2 p-3">
                            {visibleItems.map((item) => {
                              const isSelected = sel.selectedItems.has(item.id);
                              return (
                                <div
                                  key={item.id}
                                  className={`rounded-[12px] border p-3 overflow-hidden transition-colors ${
                                    isSelected
                                      ? 'border-foreground bg-secondary/50'
                                      : 'border-border hover:border-border-hover'
                                  }`}
                                >
                                  {/* Item header: name + delivery badge + select */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-semibold text-foreground">
                                        {item.materialName}
                                      </p>
                                      {item.deliveryLocation && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-foreground/10 text-foreground">
                                          {t('selectRfqModal.delivery')}
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => sel.toggleItem(item.id)}
                                      className="flex items-center justify-center gap-1.5 h-8 px-3 py-2 rounded-[12px] border border-foreground text-sm font-medium text-foreground hover:bg-accent transition-colors shrink-0"
                                    >
                                      {isSelected ? (
                                        <CrossInCircleIcon className="w-4 h-4" />
                                      ) : (
                                        <PlusInCircleIcon className="w-4 h-4" />
                                      )}
                                      {isSelected
                                        ? t('selectRfqModal.deselect')
                                        : t('selectRfqModal.select')}
                                    </button>
                                  </div>

                                  {/* Metadata grid — 2 rows x 3 columns */}
                                  <div className="grid grid-cols-3 gap-y-4 gap-x-2 pt-3">
                                    <ItemMeta
                                      icon={<CoinsIcon className="w-[18px] h-[18px]" />}
                                      label={t('approvedQuotes.pricePerUnit')}
                                      value={formatCurrency(item.unitPrice)}
                                    />
                                    <ItemMeta
                                      icon={<TaxIcon className="w-[18px] h-[18px]" />}
                                      label={t('approvedQuotes.discount')}
                                      value={
                                        item.discountPercent > 0
                                          ? `${item.discountPercent}%  (${formatCurrency(item.discountAmount)})`
                                          : '-'
                                      }
                                    />
                                    <ItemMeta
                                      icon={<PackageIcon className="w-[18px] h-[18px]" />}
                                      label={t('approvedQuotes.qtyAvailable')}
                                      value={`${item.quantity} / ${item.quantity} ${item.unit}`}
                                    />
                                    <ItemMeta
                                      icon={<CoinsIcon className="w-[18px] h-[18px]" />}
                                      label={t('approvedQuotes.lineTotalWithTax')}
                                      value={formatCurrency(item.lineTotalWithTax)}
                                    />
                                    <ItemMeta
                                      icon={<PackageIcon className="w-[18px] h-[18px]" />}
                                      label={t('selectRfqModal.project')}
                                      value={item.projectName}
                                    />
                                    <ItemMeta
                                      icon={<DateIcon className="w-[18px] h-[18px]" />}
                                      label={t('selectRfqModal.earliestDelivery')}
                                      value={formatDate(item.expectedDeliveryDate)}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </QueryContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
