import {
  getBulkOrders,
  getInvoices,
  getPurchaseOrders,
  getVendors,
  promoteOneOffVendor,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Button, toast } from '@forethread/ui-components';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { usePermissions } from '@/shared/role';

import { AddOneOffVendorModal } from './AddOneOffVendorModal';
import {
  HeadRow,
  Section,
  SectionContent,
  StatusBadge,
  TableShell,
  formatMoney,
  humanizeStatus,
  type TranslationFn,
} from './project-tab-shared';
import ProjectBulkOrdersSection from './ProjectBulkOrdersSection';
import { PAGE_SIZE, useAllRows } from './use-all-rows';

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
  /** Added for this project only (FOR-395). */
  oneOff: boolean;
}

/**
 * FRD 4.4 — vendors involved in the project and its linked bulk agreements.
 * There is no vendor↔project relation in the schema, so the vendor set is
 * derived from the project's POs, bulk orders and invoices (the documents that
 * carry both a vendor and a projectId), then enriched with the company's
 * vendor list to recover ids for linking. One-off vendors (FOR-395) are listed
 * even before any document names them, and can be added and promoted here.
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
  const { has } = usePermissions();
  const canManageVendors = has('company.create');
  const queryClient = useQueryClient();
  const [showAddOneOff, setShowAddOneOff] = useState(false);

  const poQuery = useAllRows(['purchase-orders', 'project-tab', projectId], (page) =>
    getPurchaseOrders({ projectId, limit: PAGE_SIZE, page }, { skipErrorHandler: true }),
  );
  const bulkQuery = useAllRows(['bulk-orders', 'project-tab', projectId], (page) =>
    getBulkOrders({ projectId, limit: PAGE_SIZE, page }, { skipErrorHandler: true }),
  );
  const invoiceQuery = useAllRows(['invoices', 'project-tab', projectId], (page) =>
    getInvoices({ projectId, limit: PAGE_SIZE, page }, { skipErrorHandler: true }),
  );
  // Company-wide vendor list plus this project's one-offs, used to name-match
  // ids for links.
  const vendorsQuery = useAllRows(['vendors', 'project-tab-links', projectId], (page) =>
    getVendors({ limit: PAGE_SIZE, page, projectIds: projectId }),
  );
  // This project's one-off vendors, listed even before any document names them.
  const oneOffQuery = useAllRows(['vendors', 'project-one-off', projectId], (page) =>
    getVendors({ limit: PAGE_SIZE, page, projectIds: projectId, oneOffOnly: true }),
  );

  const refreshVendors = () => void queryClient.invalidateQueries({ queryKey: ['vendors'] });
  const promote = useMutation({
    mutationFn: (vendorId: string) => promoteOneOffVendor(vendorId),
    onSuccess: () => {
      toast.success(t('detail.vendorsTab.oneOff.promoted'));
      refreshVendors();
    },
  });

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
          oneOff: false,
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
    for (const vendor of oneOffQuery.data?.items ?? []) row(vendor.companyName);
    for (const vendor of [
      ...(vendorsQuery.data?.items ?? []),
      ...(oneOffQuery.data?.items ?? []),
    ]) {
      const entry = map.get(vendor.companyName);
      if (entry) {
        entry.companyId = vendor.companyId;
        entry.status = vendor.status;
        entry.oneOff = Boolean(vendor.oneOffProject);
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [poQuery.data, bulkQuery.data, invoiceQuery.data, vendorsQuery.data, oneOffQuery.data]);

  const isLoading =
    poQuery.isLoading || bulkQuery.isLoading || invoiceQuery.isLoading || oneOffQuery.isLoading;
  const isError = poQuery.isError || bulkQuery.isError || invoiceQuery.isError;

  return (
    <div className="space-y-6">
      <Section
        title={t('detail.vendorsTab.vendors')}
        count={isLoading ? undefined : rows.length}
        action={
          canManageVendors ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddOneOff(true)}
              data-testid="add-one-off-vendor"
            >
              {t('detail.vendorsTab.oneOff.add')}
            </Button>
          ) : undefined
        }
      >
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
                ...(canManageVendors ? [''] : []),
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
                    {vendor.oneOff && (
                      <span className="ml-2 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {t('detail.vendorsTab.oneOff.badge')}
                      </span>
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
                  {canManageVendors && (
                    <td className="px-4 py-3 text-right">
                      {vendor.oneOff && vendor.companyId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={promote.isPending}
                          onClick={() => promote.mutate(vendor.companyId as string)}
                          data-testid="promote-one-off-vendor"
                        >
                          {t('detail.vendorsTab.oneOff.promote')}
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </TableShell>
        </SectionContent>
      </Section>

      {showAddOneOff && (
        <AddOneOffVendorModal
          projectId={projectId}
          onClose={() => setShowAddOneOff(false)}
          onAdded={(result) => {
            setShowAddOneOff(false);
            toast.success(
              result.oneOffProject
                ? t('detail.vendorsTab.oneOff.added', { name: result.companyName ?? '' })
                : t('detail.vendorsTab.oneOff.alreadyVendor', { name: result.companyName ?? '' }),
            );
            refreshVendors();
          }}
        />
      )}

      <ProjectBulkOrdersSection
        projectId={projectId}
        currency={currency}
        title={t('detail.vendorsTab.bulkAgreements')}
        withDrawdowns={false}
      />
    </div>
  );
}
