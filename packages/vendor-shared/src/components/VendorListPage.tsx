import type { VendorListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { VendorCategory } from '@forethread/shared-types/client';
import { Spinner, EmptyState, TablePagination, type DotAction } from '@forethread/ui-components';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, type SortField, type SortDir } from '../constants';
import type { VendorGroup } from '../hooks/useGroupedVendors';
import { useGroupedVendors } from '../hooks/useGroupedVendors';
import { useVendorActions } from '../hooks/useVendorActions';
import { useVendorSort } from '../hooks/useVendorSort';
import { useVendors } from '../services/vendors.service';
import { useVendorsStore } from '../state/vendors.store';

import { CompanyGroupRow } from './CompanyGroupRow';
import { VendorListToolbar } from './VendorListToolbar';
import { VendorModals } from './VendorModals';
import { VendorRow } from './VendorRow';
import { VendorTableHeader } from './VendorTableHeader';

export default function VendorListPage() {
  const { t } = useTranslation(['vendors', 'common']);
  const navigate = useNavigate();

  // Pagination & filters
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [companyFilter, setCompanyFilter] = useState<string[]>([]);
  const [specialisationFilter, setSpecialisationFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Sort
  const { sortField, sortDir, handleSort } = useVendorSort();

  // Expand / collapse
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());

  // Modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isCreateCompanyModalOpen, setIsCreateCompanyModalOpen] = useState(false);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [successAlreadyExisted, setSuccessAlreadyExisted] = useState(false);
  // Actions (mutations, dot menus, action/success modals)
  const vendorActions = useVendorActions({
    onNavigateToCompany: (companyId) => navigate(`/vendors/${companyId}`),
    onNavigateToCompanyEdit: (companyId) => navigate(`/vendors/${companyId}?edit=true`),
  });
  const { openEditModal } = useVendorsStore();

  // Query
  const { data, isLoading, isError, refetch } = useVendors({
    page,
    limit: pageSize,
    search: search || undefined,
    status: statusFilter.length === 1 ? statusFilter[0] : undefined,
    specialisation: specialisationFilter.length > 0 ? specialisationFilter.join(',') : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy: sortField ?? undefined,
    sortDir: sortDir ?? undefined,
  });

  // Grouped data
  const { companyOptions, filteredGroups } = useGroupedVendors(data?.items, companyFilter);

  const statusOptions = useMemo(
    () => [
      { value: 'INVITED', label: t('statuses.INVITED') },
      { value: 'ACTIVE', label: t('statuses.ACTIVE') },
    ],
    [t],
  );

  const specialisationOptions = useMemo(
    () =>
      Object.values(VendorCategory).map((cat) => ({
        value: cat,
        label: t(`vendorCategories.${cat}` as 'vendorCategories.ELECTRICAL'),
      })),
    [t],
  );

  const toggleCompanyExpand = (companyId: string) => {
    setExpandedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  };

  const onSortWithPageReset = (field: Parameters<typeof handleSort>[0]) => {
    handleSort(field);
    setPage(1);
  };

  return (
    <div className="p-8">
      <div className="bg-card rounded-lg border border-border p-6">
        <VendorListToolbar
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          companyOptions={companyOptions}
          companyFilter={companyFilter}
          onCompanyFilterChange={setCompanyFilter}
          statusOptions={statusOptions}
          statusFilter={statusFilter}
          onStatusFilterChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
          specialisationOptions={specialisationOptions}
          specialisationFilter={specialisationFilter}
          onSpecialisationFilterChange={(v) => {
            setSpecialisationFilter(v);
            setPage(1);
          }}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={(v) => {
            setDateFrom(v);
            setPage(1);
          }}
          onDateToChange={(v) => {
            setDateTo(v);
            setPage(1);
          }}
          onDateClear={() => {
            setDateFrom('');
            setDateTo('');
            setPage(1);
          }}
          onInviteVendor={() => setIsInviteModalOpen(true)}
          onCreateCompany={() => setIsCreateCompanyModalOpen(true)}
        />

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Spinner size="md" />
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center h-48 text-destructive text-sm">
            {t('failedToLoad')}
          </div>
        ) : !data?.items.length ? (
          <div className="py-12">
            <EmptyState title={t('noVendorsFound')} description={t('addFirstVendor')} />
          </div>
        ) : (
          <VendorTable
            groups={filteredGroups}
            expandedCompanies={expandedCompanies}
            onToggleCompany={toggleCompanyExpand}
            sortField={sortField}
            sortDir={sortDir}
            onSort={onSortWithPageReset}
            getCompanyRowActions={vendorActions.getCompanyRowActions}
            getVendorRowActions={vendorActions.getVendorRowActions}
            onEditVendor={openEditModal}
            onViewCompany={(companyId: string) => navigate(`/vendors/${companyId}`)}
            onViewUser={(userId: string) => navigate(`/settings/users/${userId}`)}
          />
        )}

        {data && data.meta.total > 0 && (
          <TablePagination
            page={data.meta.page}
            totalItems={data.meta.total}
            pageSize={pageSize}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            rowsPerPageLabel={t('common:rowsPerPage')}
            showingLabel={({ from, to, total }) => t('common:showingItems', { from, to, total })}
            backLabel={t('common:back')}
            nextLabel={t('common:next')}
            className=""
          />
        )}
      </div>

      <VendorModals
        isInviteModalOpen={isInviteModalOpen}
        onCloseInviteModal={() => setIsInviteModalOpen(false)}
        onInviteSuccess={(email, alreadyExisted) => {
          setSuccessEmail(email);
          setSuccessAlreadyExisted(alreadyExisted);
        }}
        isCreateCompanyModalOpen={isCreateCompanyModalOpen}
        onCloseCreateCompanyModal={() => setIsCreateCompanyModalOpen(false)}
        successEmail={successEmail}
        successAlreadyExisted={successAlreadyExisted}
        onCloseSuccessModal={() => {
          setSuccessEmail(null);
          void refetch();
        }}
        vendorActions={vendorActions}
      />
    </div>
  );
}

/* ── Vendor Table (table wrapper with header + grouped rows) ── */

interface VendorTableProps {
  groups: VendorGroup[];
  expandedCompanies: Set<string>;
  onToggleCompany: (companyId: string) => void;
  sortField: SortField | null;
  sortDir: SortDir | null;
  onSort: (field: SortField) => void;
  getCompanyRowActions: (companyId: string, group?: VendorGroup) => DotAction[];
  getVendorRowActions: (vendor: VendorListItem) => DotAction[];
  onEditVendor: (userId: string) => void;
  onViewCompany: (companyId: string) => void;
  onViewUser: (userId: string) => void;
}

function VendorTable({
  groups,
  expandedCompanies,
  onToggleCompany,
  sortField,
  sortDir,
  onSort,
  getCompanyRowActions,
  getVendorRowActions,
  onEditVendor,
  onViewCompany,
  onViewUser,
}: VendorTableProps) {
  return (
    <div className="border border-border rounded-lg overflow-x-auto">
      <table className="w-full min-w-[800px] text-sm">
        <VendorTableHeader sortField={sortField} sortDir={sortDir} onSort={onSort} />
        <tbody className="divide-y divide-border">
          {groups.map((group) => {
            const isExpanded = expandedCompanies.has(group.companyId);
            return (
              <VendorGroupSection
                key={group.companyId}
                group={group}
                isExpanded={isExpanded}
                onToggle={() => onToggleCompany(group.companyId)}
                getCompanyRowActions={getCompanyRowActions}
                getVendorRowActions={getVendorRowActions}
                onEditVendor={onEditVendor}
                onViewCompany={onViewCompany}
                onViewUser={onViewUser}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Vendor Group Section (company header + vendor rows) ── */

interface VendorGroupSectionProps {
  group: VendorGroup;
  isExpanded: boolean;
  onToggle: () => void;
  getCompanyRowActions: (companyId: string, group?: VendorGroup) => DotAction[];
  getVendorRowActions: (vendor: VendorListItem) => DotAction[];
  onEditVendor: (userId: string) => void;
  onViewCompany: (companyId: string) => void;
  onViewUser: (userId: string) => void;
}

function VendorGroupSection({
  group,
  isExpanded,
  onToggle,
  getCompanyRowActions,
  getVendorRowActions,
  onEditVendor,
  onViewCompany,
  onViewUser,
}: VendorGroupSectionProps) {
  const vendor = group.vendors[0];

  return (
    <>
      <CompanyGroupRow
        companyName={group.companyName}
        companyId={group.companyId}
        categories={group.categories}
        isExpanded={isExpanded}
        onToggle={onToggle}
        actions={getCompanyRowActions(group.companyId, group)}
        onView={() => onViewCompany(group.companyId)}
      />
      {isExpanded &&
        vendor &&
        vendor.representatives.map((rep) => (
          <VendorRow
            key={rep.id}
            vendor={{
              ...vendor,
              userId: rep.id,
              contactName: rep.name,
              contactEmail: rep.email,
              contactPhone: rep.phone ?? null,
              status: rep.status,
              assignedAt: rep.createdAt ?? vendor.assignedAt,
            }}
            actions={getVendorRowActions({
              ...vendor,
              userId: rep.id,
              contactName: rep.name,
              contactEmail: rep.email,
              status: rep.status,
            })}
            onView={() => onViewUser(rep.id)}
            onEdit={onEditVendor}
          />
        ))}
    </>
  );
}
