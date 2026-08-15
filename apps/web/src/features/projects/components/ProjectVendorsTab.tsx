import { useBulkOrders } from '@forethread/bulk-order-shared';
import { useTranslation } from '@forethread/i18n';
import { useInvoices } from '@forethread/invoice-shared';
import { usePurchaseOrders } from '@forethread/po-shared';
import { useVendors } from '@forethread/vendor-shared';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import {
  HeadRow,
  LIST_LIMIT,
  Section,
  SectionContent,
  StatusBadge,
  TableShell,
  formatMoney,
  humanizeStatus,
  type TranslationFn,
} from './project-tab-shared';
import ProjectBulkOrdersSection from './ProjectBulkOrdersSection';

/** Mirrors the vendor list's chips: active = green, invited = orange. */
const VENDOR_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-success/10 text-success',
  INVITED: 'bg-[hsl(var(--badge-orange))] text-[hsl(var(--badge-orange-text))]',
};

interface ProjectVendorRow {
  name: string;
  poCount: number;
  poTotal: number;
  bulkCount: number;
  invoiceCount: number;
  invoiceTotal: number;
  /** Vendor company id when the name matches the company's vendor list — enables the detail link. */
  companyId: string | null;
  status: string | null;
}

/**
 * FRD 4.4 — vendors involved in the project and its linked bulk agreements.
 * There is no vendor↔project relation in the schema, so the vendor set is
 * derived from the project's POs, bulk orders and invoices (the documents that
 * carry both a vendor and a projectId), then enriched with the company's
 * vendor list to recover ids for linking.
 */
export default function ProjectVendorsTab({
  projectId,
  currency,
}: {
  projectId: string;
  currency: string;
}) {
  const { t: tRaw } = useTranslation('projects');
  const t = tRaw as TranslationFn;
  const { t: tVendorsRaw } = useTranslation('vendors');
  const tVendors = tVendorsRaw as TranslationFn;

  const poQuery = usePurchaseOrders({ projectId, limit: LIST_LIMIT });
  const bulkQuery = useBulkOrders({ projectId, limit: LIST_LIMIT });
  const invoiceQuery = useInvoices({ projectId, limit: LIST_LIMIT });
  const vendorsQuery = useVendors({ limit: LIST_LIMIT });

  const rows = useMemo<ProjectVendorRow[]>(() => {
    const map = new Map<string, ProjectVendorRow>();
    const row = (name: string): ProjectVendorRow => {
      let entry = map.get(name);
      if (!entry) {
        entry = {
          name,
          poCount: 0,
          poTotal: 0,
          bulkCount: 0,
          invoiceCount: 0,
          invoiceTotal: 0,
          companyId: null,
          status: null,
        };
        map.set(name, entry);
      }
      return entry;
    };

    for (const po of poQuery.data?.items ?? []) {
      if (!po.vendorName) continue;
      const entry = row(po.vendorName);
      entry.poCount += 1;
      entry.poTotal += po.totalAmount ?? 0;
    }
    for (const bo of bulkQuery.data?.items ?? []) {
      if (!bo.vendorName) continue;
      row(bo.vendorName).bulkCount += 1;
    }
    for (const invoice of invoiceQuery.data?.items ?? []) {
      if (!invoice.vendorName) continue;
      const entry = row(invoice.vendorName);
      entry.invoiceCount += 1;
      entry.invoiceTotal += invoice.totalAmount ?? 0;
    }
    for (const vendor of vendorsQuery.data?.items ?? []) {
      const entry = map.get(vendor.companyName);
      if (entry) {
        entry.companyId = vendor.companyId;
        entry.status = vendor.status;
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [poQuery.data, bulkQuery.data, invoiceQuery.data, vendorsQuery.data]);

  const isLoading = poQuery.isLoading || bulkQuery.isLoading || invoiceQuery.isLoading;
  const isError = poQuery.isError || bulkQuery.isError || invoiceQuery.isError;

  return (
    <div className="space-y-6">
      <Section title={t('detail.vendorsTab.vendors')} count={isLoading ? undefined : rows.length}>
        <SectionContent
          isLoading={isLoading}
          isError={isError}
          isEmpty={rows.length === 0}
          errorText={t('detail.loadError')}
          emptyTitle={t('detail.vendorsTab.noVendors')}
          emptyDescription={t('detail.vendorsTab.noVendorsHint')}
        >
          <TableShell>
            <HeadRow
              labels={[
                t('detail.vendorsTab.columns.vendor'),
                t('detail.vendorsTab.columns.status'),
                t('detail.vendorsTab.columns.pos'),
                t('detail.vendorsTab.columns.poTotal'),
                t('detail.vendorsTab.columns.bulkAgreements'),
                t('detail.vendorsTab.columns.invoices'),
                t('detail.vendorsTab.columns.invoicedTotal'),
              ]}
            />
            <tbody>
              {rows.map((vendor) => (
                <tr key={vendor.name} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    {vendor.companyId ? (
                      <Link
                        to={ROUTES.vendorDetail.replace(':id', vendor.companyId)}
                        className="font-medium text-primary hover:underline"
                      >
                        {vendor.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">{vendor.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {vendor.status ? (
                      <StatusBadge
                        colorMap={VENDOR_STATUS_COLORS}
                        status={vendor.status}
                        label={tVendors(`statuses.${vendor.status}`, {
                          defaultValue: humanizeStatus(vendor.status),
                        })}
                      />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{vendor.poCount}</td>
                  <td className="px-4 py-3 text-foreground whitespace-nowrap">
                    {formatMoney(vendor.poTotal, currency)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{vendor.bulkCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">{vendor.invoiceCount}</td>
                  <td className="px-4 py-3 text-foreground whitespace-nowrap">
                    {formatMoney(vendor.invoiceTotal, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </SectionContent>
      </Section>

      <ProjectBulkOrdersSection
        projectId={projectId}
        currency={currency}
        title={t('detail.vendorsTab.bulkAgreements')}
        withDrawdowns={false}
      />
    </div>
  );
}
