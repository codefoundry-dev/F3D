import type { PoListItem } from '@forethread/api-client';

import type { PoAdvancedFilters } from '../stores';

/**
 * Apply client-side advanced filters to PO list items.
 * Returns a new filtered array.
 */
export function filterPoItems(items: PoListItem[], filters: PoAdvancedFilters): PoListItem[] {
  return items.filter((po) => {
    // Status filter (multi-select)
    if (filters.status.length > 0 && !filters.status.includes(po.status)) {
      return false;
    }

    // Project filter (multi-select by name)
    if (filters.projectId.length > 0 && !filters.projectId.includes(po.projectName)) {
      return false;
    }

    // Vendor filter (multi-select by name)
    if (filters.vendorId.length > 0) {
      const name = po.contractorName ?? po.vendorName ?? '';
      if (!filters.vendorId.includes(name)) return false;
    }

    // PO type filter (multi-select)
    if (filters.poType.length > 0 && !filters.poType.includes(po.poType ?? '')) {
      return false;
    }

    // Total amount range
    if (filters.totalAmountFrom) {
      const min = parseFloat(filters.totalAmountFrom);
      if (!isNaN(min) && (po.totalAmount === null || po.totalAmount < min)) return false;
    }
    if (filters.totalAmountTo) {
      const max = parseFloat(filters.totalAmountTo);
      if (!isNaN(max) && (po.totalAmount === null || po.totalAmount > max)) return false;
    }

    // Issue date range
    if (filters.issueDateFrom && po.issuedAt) {
      if (po.issuedAt.slice(0, 10) < filters.issueDateFrom) return false;
    }
    if (filters.issueDateFrom && !po.issuedAt) return false;
    if (filters.issueDateTo && po.issuedAt) {
      if (po.issuedAt.slice(0, 10) > filters.issueDateTo) return false;
    }

    // Planned delivery date range
    if (filters.plannedDeliveryDateFrom && po.plannedDeliveryDate) {
      if (po.plannedDeliveryDate.slice(0, 10) < filters.plannedDeliveryDateFrom) return false;
    }
    if (filters.plannedDeliveryDateFrom && !po.plannedDeliveryDate) return false;
    if (filters.plannedDeliveryDateTo && po.plannedDeliveryDate) {
      if (po.plannedDeliveryDate.slice(0, 10) > filters.plannedDeliveryDateTo) return false;
    }

    // Created by (multi-select)
    if (filters.createdByUserId.length > 0 && !filters.createdByUserId.includes(po.createdBy)) {
      return false;
    }

    // Last modified by (multi-select)
    if (
      filters.lastModifiedByUserId.length > 0 &&
      !filters.lastModifiedByUserId.includes(po.lastModifiedBy ?? '')
    ) {
      return false;
    }

    // Operational state checkboxes (only filter when checked)
    if (filters.isBulkDrawdown && po.poType !== 'BULK') return false;
    if (filters.isHoldForRelease && !po.holdForRelease) return false;
    if (filters.needApproval && po.approvalStatus !== 'PENDING') return false;
    if (filters.hasMessages && !po.hasMessages) return false;
    if (filters.hasAttachments && po.attachmentsCount === 0) return false;

    return true;
  });
}
