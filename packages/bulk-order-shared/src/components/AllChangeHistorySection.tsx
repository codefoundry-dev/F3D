import type { BulkOrderChangeRequest, BulkOrderListItem } from '@forethread/api-client';
import { getBulkOrder, listChangeRequests } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Spinner } from '@forethread/ui-components';
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import { ChangeHistoryCard } from './ChangeHistoryCard';

interface ChangeRequestWithBulk {
  cr: BulkOrderChangeRequest;
  bulkId: string;
  bulkOrderId: string;
  currentEndDate?: string | null;
  lineItems?: {
    lineItemId: string;
    itemReference: string;
    description?: string;
    pricePerUnit: number;
    qty: number;
  }[];
}

export interface AllChangeHistorySectionProps {
  bulkOrders: BulkOrderListItem[];
  isVendorView?: boolean;
}

export function AllChangeHistorySection({
  bulkOrders,
  isVendorView = false,
}: AllChangeHistorySectionProps) {
  const { t: _t } = useTranslation('bulkOrders');
  const t = _t as (key: string, opts?: Record<string, unknown>) => string;

  const crQueries = useQueries({
    queries: bulkOrders.map((bo) => ({
      queryKey: ['bulk-orders', bo.id, 'change-requests'],
      queryFn: () => listChangeRequests(bo.id),
      enabled: !!bo.id,
      staleTime: 60_000,
    })),
  });

  // Fetch detail for each bulk order that has change requests
  const boIdsWithCrs = useMemo(() => {
    const ids: string[] = [];
    for (let i = 0; i < bulkOrders.length; i++) {
      const crs = crQueries[i]?.data;
      if (crs && crs.length > 0) ids.push(bulkOrders[i].id);
    }
    return ids;
  }, [bulkOrders, crQueries]);

  const detailQueries = useQueries({
    queries: boIdsWithCrs.map((id) => ({
      queryKey: ['bulk-order', id],
      queryFn: () => getBulkOrder(id),
      staleTime: 60_000,
    })),
  });

  const detailMap = useMemo(() => {
    const map = new Map<
      string,
      { endDate?: string | null; lineItems?: ChangeRequestWithBulk['lineItems'] }
    >();
    for (let i = 0; i < boIdsWithCrs.length; i++) {
      const detail = detailQueries[i]?.data;
      if (detail) {
        map.set(boIdsWithCrs[i], { endDate: detail.endDate, lineItems: detail.lineItems });
      }
    }
    return map;
  }, [boIdsWithCrs, detailQueries]);

  const isLoading = crQueries.some((q) => q.isLoading);

  const allItems = useMemo(() => {
    const result: ChangeRequestWithBulk[] = [];
    for (let i = 0; i < bulkOrders.length; i++) {
      const bo = bulkOrders[i];
      const crs = crQueries[i]?.data;
      if (!crs) continue;
      const detail = detailMap.get(bo.id);
      for (const cr of crs) {
        result.push({
          cr,
          bulkId: bo.bulkOrderNumber || `BULK-${bo.id.slice(0, 8).toUpperCase()}`,
          bulkOrderId: bo.id,
          currentEndDate: detail?.endDate,
          lineItems: detail?.lineItems,
        });
      }
    }
    // Sort by createdAt desc
    result.sort((a, b) => new Date(b.cr.createdAt).getTime() - new Date(a.cr.createdAt).getTime());
    return result;
  }, [bulkOrders, crQueries, detailMap]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-base font-bold text-foreground mb-4">{t('changeRequests.title')}</h2>
        <div className="flex justify-center py-8">
          <Spinner size="md" />
        </div>
      </div>
    );
  }

  if (allItems.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-base font-bold text-foreground mb-4">{t('changeRequests.title')}</h2>
      <div className="flex flex-col gap-3">
        {allItems.map((item) => (
          <ChangeHistoryCard
            key={item.cr.id}
            changeRequest={item.cr}
            bulkOrderTitle={item.bulkId}
            isVendorView={isVendorView}
            currentEndDate={item.currentEndDate}
            lineItems={item.lineItems}
          />
        ))}
      </div>
    </div>
  );
}
