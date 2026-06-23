import { getBulkOrders, getBulkOrder } from '@forethread/api-client';
import type { BulkOrderListItem, BulkOrderLineItemDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Button,
  Modal,
  ModalGridBackground,
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
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useCallback, useEffect } from 'react';

import { useItemSelectionModal } from '../hooks/useItemSelectionModal';
import type { FormValues } from '../schemas/create-po.schema';
import { EMPTY_LINE_ITEM } from '../schemas/create-po.schema';
import { formatCurrency, formatDate } from '../utils/format';

import { MetaField } from './MetaField';
import { ModalItemCard } from './ModalItemCard';
import { ModalListView } from './ModalListView';

type ModalView = 'list' | 'viewItems' | 'addItems';

interface BulkOrdersModalProps {
  open: boolean;
  onClose: () => void;
  onAddItems: (items: FormValues['lineItems']) => void;
  vendorId?: string;
  existingMaterialNames?: Set<string>;
}

export function BulkOrdersModal({
  open,
  onClose,
  onAddItems,
  vendorId,
  existingMaterialNames = new Set(),
}: BulkOrdersModalProps) {
  const { t } = useTranslation('purchaseOrders');
  const [view, setView] = useState<ModalView>('list');
  const [selectedBo, setSelectedBo] = useState<BulkOrderListItem | null>(null);
  const sel = useItemSelectionModal();

  const { data: boData, isLoading: boLoading } = useQuery({
    queryKey: ['bulk-orders', 'po-modal', vendorId],
    queryFn: () => getBulkOrders({ ...(vendorId ? { vendorId } : {}), limit: 50 }),
    enabled: open,
  });

  const { data: boDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['bulk-orders', selectedBo?.id],
    queryFn: () => getBulkOrder(selectedBo!.id),
    enabled: !!selectedBo?.id,
  });

  const bulkOrders = boData?.items ?? [];
  const lineItems = boDetail?.lineItems ?? [];

  const filteredBulkOrders = useMemo(
    () =>
      bulkOrders.filter(
        (bo) =>
          bo.id.toLowerCase().includes(sel.search.toLowerCase()) ||
          bo.projectName.toLowerCase().includes(sel.search.toLowerCase()) ||
          bo.vendorName.toLowerCase().includes(sel.search.toLowerCase()),
      ),
    [bulkOrders, sel.search],
  );

  const alreadyInTable = useMemo(
    () =>
      new Set(
        lineItems
          .filter((li) => existingMaterialNames.has(li.itemReference))
          .map((li) => li.lineItemId),
      ),
    [lineItems, existingMaterialNames],
  );

  useEffect(() => {
    if (view === 'addItems' && lineItems.length > 0) {
      const newIds = new Set(
        lineItems.filter((li) => !alreadyInTable.has(li.lineItemId)).map((li) => li.lineItemId),
      );
      sel.initSelectedItems(newIds);
    }
  }, [view, lineItems, alreadyInTable]); // eslint-disable-line react-hooks/exhaustive-deps

  const uomOptions = useMemo(
    () => [...new Set(lineItems.map((i) => i.unit))].map((u) => ({ value: u, label: u })),
    [lineItems],
  );

  const filteredLineItems = useMemo(
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

  const handleViewItems = useCallback(
    (bo: BulkOrderListItem) => {
      setSelectedBo(bo);
      setView('viewItems');
      sel.resetDetail();
    },
    [sel],
  );

  const handleAddFromBo = useCallback(
    (bo: BulkOrderListItem) => {
      setSelectedBo(bo);
      setView('addItems');
      sel.resetDetail();
    },
    [sel],
  );

  const handleBack = useCallback(() => {
    setView('list');
    setSelectedBo(null);
    sel.resetDetail();
  }, [sel]);

  const mapLineItemToFormItem = useCallback(
    (li: BulkOrderLineItemDetail): FormValues['lineItems'][number] => ({
      ...EMPTY_LINE_ITEM,
      materialName: li.itemReference,
      materialCode: '',
      unitOfMeasure: li.unit,
      unitPrice: li.pricePerUnit,
      quantityOrdered: li.qtyRemaining,
      description: li.description,
    }),
    [],
  );

  const handleAddSelected = useCallback(() => {
    const items = lineItems
      .filter((li) => sel.selectedItems.has(li.lineItemId) && !alreadyInTable.has(li.lineItemId))
      .map(mapLineItemToFormItem);
    if (items.length > 0) onAddItems(items);
    handleClose();
  }, [lineItems, sel.selectedItems, alreadyInTable, onAddItems, mapLineItemToFormItem]);

  const handleClose = useCallback(() => {
    setView('list');
    setSelectedBo(null);
    sel.resetAll();
    onClose();
  }, [onClose, sel]);

  const handleAddAll = useCallback(() => {
    const items = lineItems
      .filter((li) => !alreadyInTable.has(li.lineItemId))
      .map(mapLineItemToFormItem);
    if (items.length > 0) onAddItems(items);
    handleClose();
  }, [lineItems, alreadyInTable, onAddItems, mapLineItemToFormItem, handleClose]);

  const newSelectedCount = [...sel.selectedItems].filter((id) => !alreadyInTable.has(id)).length;

  if (!open) return null;

  return (
    <Modal onClose={handleClose} maxWidth="max-w-2xl" decoration={<ModalGridBackground />}>
      <div className="relative p-6 max-h-[80vh] flex flex-col">
        <ModalIconHeader
          icon={<PackageIcon className="w-6 h-6 text-foreground" />}
          title={t('bulkOrdersModal.title')}
          subtitle={t('bulkOrdersModal.subtitle')}
          onClose={handleClose}
          className="mb-6"
        />

        {view === 'list' && (
          <ModalListView
            items={filteredBulkOrders}
            search={sel.search}
            onSearchChange={sel.setSearch}
            searchPlaceholder={t('bulkOrdersModal.searchPlaceholder')}
            isLoading={boLoading}
            loadingMessage={t('bulkOrdersModal.loading')}
            emptyMessage={t('bulkOrdersModal.noBulkOrders')}
            onView={handleViewItems}
            onAdd={handleAddFromBo}
            viewTitle={t('bulkOrdersModal.viewItems')}
            addTitle={t('bulkOrdersModal.addItems')}
            renderInfo={(bo) => (
              <>
                <p className="text-sm font-medium text-foreground truncate">{bo.projectName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {bo.vendorName} / {formatDate(bo.validUntil)}
                </p>
              </>
            )}
          />
        )}

        {(view === 'viewItems' || view === 'addItems') && selectedBo && (
          <div className="flex-1 overflow-hidden flex flex-col">
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
                  {boDetail?.projectName ?? selectedBo.projectName}
                </h3>
              </div>
              <Button variant="primary" size="lg" onClick={handleAddAll}>
                {t('bulkOrdersModal.addAllItems', { defaultValue: 'Add all items' })}
              </Button>
            </div>

            <div className="rounded-lg border border-border p-4 flex-1 overflow-hidden flex flex-col">
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

              <ModalFilterPanel
                visible={sel.showFilters}
                onClose={sel.toggleFilters}
                title={t('bulkOrdersModal.filters')}
                clearLabel={t('bulkOrdersModal.clearFilters')}
                onClear={() => sel.setFilterUom('')}
                showClear={!!sel.filterUom}
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

              <SelectionBar
                selectedCount={newSelectedCount}
                alreadyInTableCount={alreadyInTable.size}
                onClear={sel.clearSelection}
                onAction={handleAddSelected}
                selectedLabel={t('bulkOrdersModal.itemsSelected')}
                alreadyInTableLabel={t('approvedQuotes.alreadyAdded', {
                  defaultValue: 'already in PO',
                })}
                actionLabel={t('bulkOrdersModal.addSelected', {
                  defaultValue: 'Add selected',
                })}
                clearTitle={t('bulkOrdersModal.clearSelection', {
                  defaultValue: 'Clear selection',
                })}
              />

              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {detailLoading ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {t('bulkOrdersModal.loading')}
                  </div>
                ) : filteredLineItems.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {t('bulkOrdersModal.noItems')}
                  </div>
                ) : (
                  filteredLineItems.map((item) => (
                    <ModalItemCard
                      key={item.lineItemId}
                      id={item.lineItemId}
                      name={item.itemReference}
                      isSelected={sel.selectedItems.has(item.lineItemId)}
                      isInTable={alreadyInTable.has(item.lineItemId)}
                      alreadyAddedLabel={t('approvedQuotes.alreadyAdded', {
                        defaultValue: 'already in PO',
                      })}
                      onToggle={sel.toggleItem}
                    >
                      <MetaField
                        icon={<CoinsIcon className="w-3.5 h-3.5" />}
                        label={t('bulkOrdersModal.pricePerUnit')}
                        value={formatCurrency(item.pricePerUnit)}
                      />
                      <MetaField
                        icon={<PackageIcon className="w-3.5 h-3.5" />}
                        label={t('bulkOrdersModal.reservedQty')}
                        value={String(item.qtyRemaining)}
                      />
                      <MetaField
                        icon={<CoinsIcon className="w-3.5 h-3.5" />}
                        label={t('bulkOrdersModal.totalWithTax')}
                        value={formatCurrency(item.totalLineInc)}
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
