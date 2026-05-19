import { useState, useCallback } from 'react';

/**
 * Manages the open/close state for all modals used in the line items step.
 * Extracted from PoCreateLineItemsStep to follow SRP.
 */
export function useLineItemModals() {
  const [approvedQuotesOpen, setApprovedQuotesOpen] = useState(false);
  const [bulkOrdersOpen, setBulkOrdersOpen] = useState(false);
  const [bulkCoverageOpen, setBulkCoverageOpen] = useState(false);
  const [rfqCoverageOpen, setRfqCoverageOpen] = useState(false);
  const [coverageMaterialName, setCoverageMaterialName] = useState('');

  const [bulkPriceWarningOpen, setBulkPriceWarningOpen] = useState(false);
  const [bulkPriceWarningData, setBulkPriceWarningData] = useState<{
    lineIndex: number;
    bulkPrice: number;
    enteredPrice: number;
  } | null>(null);

  const openApprovedQuotes = useCallback(() => setApprovedQuotesOpen(true), []);
  const closeApprovedQuotes = useCallback(() => setApprovedQuotesOpen(false), []);

  const openBulkOrders = useCallback(() => setBulkOrdersOpen(true), []);
  const closeBulkOrders = useCallback(() => setBulkOrdersOpen(false), []);

  const openBulkCoverage = useCallback((materialName: string) => {
    setCoverageMaterialName(materialName);
    setBulkCoverageOpen(true);
  }, []);
  const closeBulkCoverage = useCallback(() => setBulkCoverageOpen(false), []);

  const openRfqCoverage = useCallback((materialName: string) => {
    setCoverageMaterialName(materialName);
    setRfqCoverageOpen(true);
  }, []);
  const closeRfqCoverage = useCallback(() => setRfqCoverageOpen(false), []);

  const closeBulkPriceWarning = useCallback(() => {
    setBulkPriceWarningOpen(false);
    setBulkPriceWarningData(null);
  }, []);

  return {
    approvedQuotesOpen,
    openApprovedQuotes,
    closeApprovedQuotes,

    bulkOrdersOpen,
    openBulkOrders,
    closeBulkOrders,

    bulkCoverageOpen,
    openBulkCoverage,
    closeBulkCoverage,
    coverageMaterialName,

    rfqCoverageOpen,
    openRfqCoverage,
    closeRfqCoverage,

    bulkPriceWarningOpen,
    bulkPriceWarningData,
    setBulkPriceWarningOpen,
    setBulkPriceWarningData,
    closeBulkPriceWarning,
  };
}
