import { useTranslation } from '@forethread/i18n';
import { Alert, Button, MaterialSearchPanel } from '@forethread/ui-components';
import WarningCircleIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
import { useState, useCallback, useMemo } from 'react';
import {
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFieldArrayReturn,
  useWatch,
} from 'react-hook-form';

import type { FormValues } from '../schemas/create-po.schema';

import { useMaterialSearch } from '../hooks/useMaterialSearch';
import { useLineItemValidation } from '../hooks/useLineItemValidation';
import { useLineItemModals } from '../hooks/useLineItemModals';
import { useLineItemsCrud } from '../hooks/useLineItemsCrud';
import { ApprovedQuotesModal } from './ApprovedQuotesModal';
import { BulkOrderCoverageModal } from './BulkOrderCoverageModal';
import { BulkOrdersModal } from './BulkOrdersModal';
import { BulkPriceWarningModal } from './BulkPriceWarningModal';
import { RfqCoverageModal } from './RfqCoverageModal';
import { LineItemRow } from './LineItemRow';
import { LineItemsTableHeader } from './LineItemsTableHeader';

interface PoCreateLineItemsStepProps {
  register: UseFormRegister<FormValues>;
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
  fields: UseFieldArrayReturn<FormValues, 'lineItems'>['fields'];
  append: UseFieldArrayReturn<FormValues, 'lineItems'>['append'];
  remove: UseFieldArrayReturn<FormValues, 'lineItems'>['remove'];
  setValue: UseFormSetValue<FormValues>;
  locationOptions: { value: string; label: string }[];
  totalItems: number;
  totalQty: number;
  vendorId?: string;
  projectId?: string;
  /** True when PO is being created manually (not from RFQ/bulk order) */
  isManualMode?: boolean;
  /** Called when user accepts a vendor suggestion from validation */
  onVendorSuggested?: (vendorId: string) => void;
}

export function PoCreateLineItemsStep({
  register,
  control,
  errors,
  fields,
  append,
  remove,
  setValue,
  locationOptions,
  totalItems,
  totalQty,
  vendorId,
  projectId,
  isManualMode,
  onVendorSuggested,
}: PoCreateLineItemsStepProps) {
  const { t } = useTranslation('purchaseOrders');
  const watchedLineItems = useWatch({ control, name: 'lineItems' });

  // Validation
  const { suggestions: validationSuggestions } = useLineItemValidation({
    projectId: projectId ?? '',
    lineItems: watchedLineItems ?? [],
    enabled: isManualMode ?? false,
  });

  // Material names already in the table (for dedup in modals)
  const existingMaterialNames = useMemo(
    () =>
      new Set(
        (watchedLineItems ?? []).filter((li) => li.materialName).map((li) => li.materialName),
      ),
    [watchedLineItems],
  );

  // Modal orchestration (SRP: extracted to dedicated hook)
  const modals = useLineItemModals();

  // Line item CRUD operations (SRP: extracted to dedicated hook)
  const crud = useLineItemsCrud({ watchedLineItems, append, remove, setValue });

  // Top-bar material search
  const topSearch = useMaterialSearch();

  // Bulk price mismatch alert — placeholder for API integration
  const [hasBulkPriceMismatch] = useState(false);

  // Approved RFQ alert — show when any filled item has approved quotes
  const [alertDismissed, setAlertDismissed] = useState(false);
  const hasApprovedQuotes =
    !alertDismissed && (watchedLineItems ?? []).some((li) => li.materialName);

  const handleAddToList = useCallback(() => {
    crud.handleAddFromSearch([...topSearch.selected]);
    topSearch.reset();
  }, [crud, topSearch]);

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-lg sm:text-[22px] font-medium leading-6 sm:leading-4 text-foreground">
          Step 2 of 3: {t('create.step2Title')}
        </h2>
        <p className="text-sm text-muted-foreground mt-2">{t('create.step2Subtitle')}</p>
      </div>

      <div className="bg-background border border-border rounded-lg p-4 sm:p-6">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-start gap-3 mb-6">
          <div className="flex-1">
            <MaterialSearchPanel
              search={topSearch.search}
              onSearchChange={topSearch.setSearch}
              results={topSearch.results}
              selected={topSearch.selected}
              onSelect={topSearch.handleSelect}
              onDeselect={topSearch.handleDeselect}
              onQuantityChange={topSearch.handleQtyChange}
              onAddToList={handleAddToList}
              filters={topSearch.filters}
              onFiltersChange={topSearch.setFilters}
              open={topSearch.panelOpen}
              onOpenChange={topSearch.setPanelOpen}
              searchPlaceholder={t('create.searchMaterials')}
              addToListLabel={t('create.addToList', { defaultValue: 'Add to list' })}
            />
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={modals.openApprovedQuotes}
            disabled={!vendorId}
          >
            {t('create.selectApprovedQuotes')}
          </Button>
          <Button variant="primary" size="lg" onClick={modals.openBulkOrders} disabled={!vendorId}>
            {t('create.selectBulkOrders')}
          </Button>
        </div>

        {/* Bulk price mismatch alert */}
        {hasBulkPriceMismatch && (
          <Alert
            variant="destructive"
            icon={<WarningCircleIcon className="w-[18px] h-[18px]" />}
            className="mb-6"
          >
            <p className="text-sm whitespace-pre-line">{t('bulkPriceMismatchAlert')}</p>
          </Alert>
        )}

        {/* Line items table + totals */}
        <div className="rounded-lg border border-border bg-background overflow-visible">
          <table
            className="w-full text-sm table-fixed"
            style={{ borderCollapse: 'separate', borderSpacing: 0 }}
          >
            <LineItemsTableHeader />
            <tbody>
              {(() => {
                let emptyRendered = false;
                return fields.map((field, index) => {
                  const item = watchedLineItems?.[index];
                  const isEmpty = !item?.materialName;
                  if (isEmpty) {
                    if (emptyRendered) return null;
                    emptyRendered = true;
                  }
                  const suggestion = validationSuggestions.find((s) => s.lineItemIndex === index);
                  return (
                    <LineItemRow
                      key={field.id}
                      index={index}
                      isFilled={!isEmpty}
                      isLast={index === fields.length - 1}
                      hasNotes={crud.notesOpenRow.has(index)}
                      item={item}
                      register={register}
                      control={control}
                      errors={errors}
                      setValue={setValue}
                      remove={crud.handleRemoveRow}
                      locationOptions={locationOptions}
                      onToggleNotes={crud.toggleNotes}
                      materialSearch={{
                        cellSearchOpen: crud.cellSearchOpen,
                        cellSearchQuery: crud.cellSearchQuery,
                        onCellSearchChange: crud.handleCellSearchChange,
                        onCellSearchClose: crud.handleCellSearchClose,
                        results: topSearch.results,
                        selected: topSearch.selected,
                        filters: topSearch.filters,
                        onFiltersChange: topSearch.setFilters,
                        onDeselect: topSearch.handleDeselect,
                        onQtyChange: topSearch.handleQtyChange,
                        addToListLabel: t('create.addToList', { defaultValue: 'Add to list' }),
                      }}
                      approvedQuotesCount={suggestion?.rfqMatch ? 1 : 0}
                      bulkOrdersCount={suggestion?.bulkOrderMatch ? 1 : 0}
                      onApprRfqClick={() => {
                        modals.openRfqCoverage(item?.materialName ?? '');
                      }}
                      onBulkOrderClick={() => {
                        modals.openBulkCoverage(item?.materialName ?? '');
                      }}
                    />
                  );
                });
              })()}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex gap-6 text-sm text-muted-foreground px-3 py-3 border-t border-border">
            <span>
              {t('create.totalItems')}{' '}
              <span className="text-foreground font-medium">{totalItems}</span>
            </span>
            <span>
              {t('create.totalQty')} <span className="text-foreground font-medium">{totalQty}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Approved RFQ alert */}
      {hasApprovedQuotes && vendorId && (
        <Alert
          variant="success"
          icon={<WarningCircleIcon className="w-[18px] h-[18px]" />}
          className="mt-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm">
              {t('create.approvedRfqAlert')}{' '}
              <button
                type="button"
                onClick={modals.openApprovedQuotes}
                className="font-bold underline"
              >
                {t('create.approvedRfqAlertView')}
              </button>
            </p>
            <button
              type="button"
              onClick={() => setAlertDismissed(true)}
              className="text-current hover:opacity-70 transition-opacity ml-3"
            >
              <CrossIcon className="w-3 h-3" />
            </button>
          </div>
        </Alert>
      )}

      <ApprovedQuotesModal
        open={modals.approvedQuotesOpen}
        onClose={modals.closeApprovedQuotes}
        onAddItems={crud.handleAddModalItems}
        vendorId={vendorId}
        existingMaterialNames={existingMaterialNames}
      />

      <BulkOrdersModal
        open={modals.bulkOrdersOpen}
        onClose={modals.closeBulkOrders}
        onAddItems={crud.handleAddModalItems}
        vendorId={vendorId}
        existingMaterialNames={existingMaterialNames}
      />

      <BulkOrderCoverageModal
        open={modals.bulkCoverageOpen}
        onClose={modals.closeBulkCoverage}
        materialName={modals.coverageMaterialName}
        vendorId={vendorId}
        onAddItems={crud.handleAddModalItems}
        onVendorSuggested={onVendorSuggested}
      />

      <RfqCoverageModal
        open={modals.rfqCoverageOpen}
        onClose={modals.closeRfqCoverage}
        materialName={modals.coverageMaterialName}
        vendorId={vendorId}
        onAddToPo={crud.handleAddModalItems}
        onVendorSuggested={onVendorSuggested}
      />

      {modals.bulkPriceWarningData && (
        <BulkPriceWarningModal
          open={modals.bulkPriceWarningOpen}
          onClose={modals.closeBulkPriceWarning}
          bulkPrice={modals.bulkPriceWarningData.bulkPrice}
          enteredPrice={modals.bulkPriceWarningData.enteredPrice}
          onUseBulkPrice={() => {
            setValue(
              `lineItems.${modals.bulkPriceWarningData!.lineIndex}.unitPrice`,
              modals.bulkPriceWarningData!.bulkPrice,
            );
            modals.closeBulkPriceWarning();
          }}
          onKeepCustomPrice={modals.closeBulkPriceWarning}
        />
      )}
    </section>
  );
}
