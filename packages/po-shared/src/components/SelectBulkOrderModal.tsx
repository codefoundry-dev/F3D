import { getBulkOrders, getBulkOrder } from '@forethread/api-client';
import type { BulkOrderListItem } from '@forethread/api-client';
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
import BackArrowIcon from '@forethread/ui-components/assets/icons/back-arrow.svg?react';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import CoinsIcon from '@forethread/ui-components/assets/icons/coins.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';

import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import PlusInCircleIcon from '@forethread/ui-components/assets/icons/plus-in-circle.svg?react';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useCallback } from 'react';

import { useItemSelectionModal } from '../hooks/useItemSelectionModal';
import { formatCurrency, formatDate } from '../utils/format';

type ModalView = 'list' | 'detail';

interface SelectBulkOrderModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (bo: BulkOrderListItem, selectedItemIds?: Set<string>) => void;
}

export function SelectBulkOrderModal({ open, onClose, onSelect }: SelectBulkOrderModalProps) {
  const { t } = useTranslation('purchaseOrders');
  const [view, setView] = useState<ModalView>('list');
  const [selectedBo, setSelectedBo] = useState<BulkOrderListItem | null>(null);
  const sel = useItemSelectionModal();

  const { data, isLoading } = useQuery({
    queryKey: ['bulk-orders', 'select-for-po'],
    queryFn: () => getBulkOrders({ limit: 50 }),
    enabled: open,
  });

  const { data: boDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['bulk-orders', selectedBo?.id],
    queryFn: () => getBulkOrder(selectedBo!.id),
    enabled: !!selectedBo?.id,
  });

  const bulkOrders = data?.items ?? [];
  const lineItems = boDetail?.lineItems ?? [];

  const filtered = useMemo(
    () =>
      bulkOrders.filter(
        (bo) =>
          bo.projectName.toLowerCase().includes(sel.search.toLowerCase()) ||
          bo.vendorName.toLowerCase().includes(sel.search.toLowerCase()) ||
          bo.id.toLowerCase().includes(sel.search.toLowerCase()),
      ),
    [bulkOrders, sel.search],
  );

  // Filter detail items by search + UoM
  const filteredItems = useMemo(
    () =>
      lineItems.filter((item) => {
        const matchesSearch =
          item.itemReference.toLowerCase().includes(sel.itemSearch.toLowerCase()) ||
          item.description.toLowerCase().includes(sel.itemSearch.toLowerCase());
        const matchesUom = !sel.filterUom || item.unit === sel.filterUom;
        return matchesSearch && matchesUom;
      }),
    [lineItems, sel.itemSearch, sel.filterUom],
  );

  // Unique UoM values for filter
  const uomOptions = useMemo(
    () => [...new Set(lineItems.map((i) => i.unit))].map((u) => ({ value: u, label: u })),
    [lineItems],
  );

  const handleViewItems = useCallback(
    (bo: BulkOrderListItem) => {
      setSelectedBo(bo);
      setView('detail');
      sel.resetDetail();
    },
    [sel],
  );

  const handleBack = useCallback(() => {
    setView('list');
    setSelectedBo(null);
    sel.resetDetail();
  }, [sel]);

  const handleClose = useCallback(() => {
    setView('list');
    setSelectedBo(null);
    sel.resetAll();
    onClose();
  }, [onClose, sel]);

  const handleAddAll = useCallback(() => {
    if (selectedBo) onSelect(selectedBo);
  }, [selectedBo, onSelect]);

  const handleAddSelected = useCallback(() => {
    if (selectedBo && sel.selectedItems.size > 0) {
      onSelect(selectedBo, new Set(sel.selectedItems));
    }
  }, [selectedBo, sel.selectedItems, onSelect]);

  if (!open) return null;

  return (
    <Modal onClose={handleClose} maxWidth="max-w-[1024px]" decoration={<ModalGridBackground />}>
      <div className="relative p-8 max-h-[80vh] flex flex-col">
        <ModalIconHeader
          icon={<CheckCircleIcon className="w-6 h-6 text-foreground" />}
          title={t('selectBoModal.title')}
          subtitle={t('selectBoModal.subtitle')}
          onClose={handleClose}
          className="mb-10"
        />

        {view === 'list' ? (
          /* ── List View ─────────────────────────────────────────── */
          <div className="rounded-xl border border-border p-4 flex-1 overflow-hidden flex flex-col">
            <SearchInput
              value={sel.search}
              onChange={(e) => sel.setSearch(e.target.value)}
              placeholder={t('selectBoModal.searchPlaceholder')}
              className="mb-3"
            />

            <div className="flex-1 overflow-y-auto space-y-1 min-h-0 max-h-[356px]">
              <QueryContainer
                isLoading={isLoading}
                isEmpty={filtered.length === 0}
                emptyMessage={t('selectBoModal.noBulkOrders')}
              >
                {filtered.map((bo) => (
                  <div
                    key={bo.id}
                    className="flex items-center gap-3 w-full rounded-lg border border-border p-3 hover:border-border-hover transition-colors cursor-pointer"
                    onClick={() => onSelect(bo)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onSelect(bo);
                    }}
                  >
                    <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <PackageIcon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate leading-5">
                        {bo.projectName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate leading-4">
                        {bo.vendorName}
                        {bo.validUntil ? ` / ${formatDate(bo.validUntil)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewItems(bo);
                      }}
                      title={t('bulkOrdersModal.viewItems')}
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
            {/* Sub-header: back + BO name + Add all items */}
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={handleBack}
                className="p-1 text-foreground hover:text-foreground/70 transition-colors shrink-0"
              >
                <BackArrowIcon className="w-6 h-6" />
              </button>
              <h3 className="flex-1 text-[22px] font-medium text-foreground min-w-0 truncate">
                {boDetail?.projectName ?? selectedBo?.projectName}
              </h3>
              <Button variant="primary" size="lg" onClick={handleAddAll}>
                {t('bulkOrdersModal.addAllItems')}
              </Button>
            </div>

            {/* Card with search + filters + items */}
            <div className="rounded-xl border border-border p-4 flex-1 overflow-hidden flex flex-col">
              {/* Search + Filters */}
              <div className="flex items-center gap-2 mb-3">
                <SearchInput
                  value={sel.itemSearch}
                  onChange={(e) => sel.setItemSearch(e.target.value)}
                  placeholder={t('bulkOrdersModal.searchPlaceholder')}
                  className="flex-1"
                />
                <FiltersButton
                  active={sel.showFilters}
                  onClick={sel.toggleFilters}
                  label={t('bulkOrdersModal.filters')}
                />
              </div>

              {/* Filter panel */}
              <ModalFilterPanel
                visible={sel.showFilters}
                onClose={sel.toggleFilters}
                title={t('bulkOrdersModal.filters')}
                clearLabel={t('bulkOrdersModal.clearFilters')}
                onClear={() => sel.setFilterUom('')}
                showClear={!!sel.filterUom}
                className="mb-3"
              >
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-foreground">
                    {t('bulkOrdersModal.filterUom')}
                  </label>
                  <CustomDropdown
                    options={uomOptions}
                    value={sel.filterUom}
                    onChange={sel.setFilterUom}
                    placeholder="All UoM"
                  />
                </div>
              </ModalFilterPanel>

              {/* Selection bar */}
              {sel.selectedItems.size > 0 && (
                <SelectionBar
                  selectedCount={sel.selectedItems.size}
                  onClear={sel.clearSelection}
                  onAction={handleAddSelected}
                  selectedLabel={t('bulkOrdersModal.itemsSelected')}
                  actionLabel={t('selectBoModal.addItems', { defaultValue: 'Add items' })}
                  clearTitle={t('selectBoModal.clearSelection', {
                    defaultValue: 'Clear selection',
                  })}
                  className="mb-3 px-1"
                />
              )}

              {/* Items list */}
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0 max-h-[356px]">
                <QueryContainer
                  isLoading={detailLoading}
                  isEmpty={filteredItems.length === 0}
                  emptyMessage={t('bulkOrdersModal.noItems')}
                >
                  {filteredItems.map((item) => {
                    const isSelected = sel.selectedItems.has(item.lineItemId);
                    return (
                      <div
                        key={item.lineItemId}
                        className={`rounded-xl border p-3 transition-colors ${
                          isSelected
                            ? 'border-foreground bg-secondary/50'
                            : 'border-border hover:border-border-hover'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <p className="text-sm font-semibold text-foreground">
                            {item.itemReference}
                          </p>
                          <button
                            type="button"
                            onClick={() => sel.toggleItem(item.lineItemId)}
                            className="flex items-center justify-center gap-1.5 h-8 px-3 py-2 rounded-[12px] border border-foreground text-sm font-medium text-foreground hover:bg-accent transition-colors shrink-0"
                          >
                            {isSelected ? (
                              <CrossInCircleIcon className="w-4 h-4" />
                            ) : (
                              <PlusInCircleIcon className="w-4 h-4" />
                            )}
                            {isSelected
                              ? t('selectBoModal.deselect', { defaultValue: 'Deselect' })
                              : t('selectBoModal.select', { defaultValue: 'Select' })}
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2 py-2">
                          <ItemMeta
                            icon={<CoinsIcon className="w-4 h-4" />}
                            label={t('bulkOrdersModal.pricePerUnit')}
                            value={formatCurrency(item.pricePerUnit)}
                            className="w-[147px]"
                          />
                          <ItemMeta
                            icon={<PackageIcon className="w-4 h-4" />}
                            label={t('bulkOrdersModal.reservedQty')}
                            value={String(item.qtyRemaining)}
                            className="w-[147px]"
                          />
                          <ItemMeta
                            icon={<CoinsIcon className="w-4 h-4" />}
                            label={t('bulkOrdersModal.totalWithTax')}
                            value={formatCurrency(item.totalLineInc)}
                            className="w-[147px]"
                          />
                        </div>
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
