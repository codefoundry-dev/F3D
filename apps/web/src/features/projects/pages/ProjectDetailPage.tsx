import type {
  ProjectDetail,
  ProjectLocationResponse,
  ProjectMemberResponse,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { UserRole } from '@forethread/shared-types/client';
import {
  Spinner,
  Badge,
  Button,
  Checkbox,
  Modal,
  ConfirmDialog,
  buttonVariants,
} from '@forethread/ui-components';
import { useCallback, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useAuthStore } from '@/features/auth/state/auth.store';
import { BomTab } from '@/features/boms';

import {
  useProject,
  useAddProjectMembers,
  useRemoveProjectMember,
  useCompanyUsers,
} from '../services/projects.service';

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

type Tab = 'overview' | 'members' | 'bom' | 'procurement' | 'financial';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('projects');
  const currentUser = useAuthStore((s) => s.currentUser);
  const { data: project, isLoading, isError } = useProject(id ?? '');

  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs: Tab[] = ['overview', 'members', 'bom', 'procurement', 'financial'];
  const tabParam = searchParams.get('tab') as Tab | null;
  const activeTab: Tab = tabParam && validTabs.includes(tabParam) ? tabParam : 'overview';
  const setActiveTab = useCallback(
    (tab: Tab) => setSearchParams({ tab }, { replace: true }),
    [setSearchParams],
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);

  // Both COMPANY_ADMIN and PROCUREMENT_OFFICER manage projects in the unified app
  // (the buyer-side projects feature is shared between them per MIGRATION.md).
  const canManageProject =
    currentUser?.role === UserRole.COMPANY_ADMIN ||
    currentUser?.role === UserRole.PROCUREMENT_OFFICER;

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="p-8">
        <p className="text-destructive">{t('detail.notFound')}</p>
        <Link
          to={ROUTES.projects}
          className="text-sm text-primary hover:underline mt-2 inline-block"
        >
          {t('detail.backToProjects')}
        </Link>
      </div>
    );
  }

  const deliveryLocations = project.locations.filter((l) => l.type === 'DELIVERY');
  const storageLocations = project.locations.filter((l) => l.type === 'STORAGE');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: t('detail.overview') },
    { key: 'members', label: `${t('detail.members')} (${project.assignedUsers.length})` },
    { key: 'bom', label: t('detail.billOfMaterials') },
    { key: 'procurement', label: t('detail.procurementDocs') },
    { key: 'financial', label: t('detail.financialSummary') },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
            <StatusBadge status={project.status} t={t as TranslationFn} />
          </div>
          {canManageProject && (
            <Link to={ROUTES.projectEdit.replace(':id', id ?? '')} className={buttonVariants()}>
              {t('detail.editProject')}
            </Link>
          )}
        </div>
        {project.description && <p className="mt-2 text-muted-foreground">{project.description}</p>}
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          project={project}
          deliveryLocations={deliveryLocations}
          storageLocations={storageLocations}
          t={t as TranslationFn}
        />
      )}

      {activeTab === 'members' && (
        <MembersTab
          project={project}
          canManageProject={canManageProject}
          onAdd={() => setShowAddModal(true)}
          onRemove={(member) => setConfirmRemove({ id: member.id, name: member.name })}
          t={t as TranslationFn}
        />
      )}

      {activeTab === 'bom' && <BomTab projectId={id ?? ''} />}

      {activeTab === 'procurement' && (
        <div className="text-center py-12 text-muted-foreground">
          {t('detail.procurementPlaceholder')}
        </div>
      )}

      {activeTab === 'financial' && (
        <div className="text-center py-12 text-muted-foreground">
          {t('detail.financialPlaceholder')}
        </div>
      )}

      {/* Add Members Modal */}
      {showAddModal && (
        <AddMembersModal
          projectId={id ?? ''}
          existingMemberIds={project.assignedUsers.map((m) => m.id)}
          onClose={() => setShowAddModal(false)}
          t={t as TranslationFn}
        />
      )}

      {/* Remove Confirmation */}
      {confirmRemove && (
        <RemoveConfirmDialog
          projectId={id ?? ''}
          member={confirmRemove}
          onClose={() => setConfirmRemove(null)}
          t={t as TranslationFn}
        />
      )}
    </div>
  );
}

function StatusBadge({ status, t }: { status: string; t: TranslationFn }) {
  const colorMap: Record<string, string> = {
    PLANNED: 'bg-[hsl(var(--badge-blue))] text-[hsl(var(--badge-blue-text))]',
    ONGOING: 'bg-[hsl(var(--badge-teal))] text-[hsl(var(--badge-teal-text))]',
    COMPLETED: 'bg-success/10 text-success',
    ARCHIVED: 'bg-[hsl(var(--badge-orange))] text-[hsl(var(--badge-orange-text))]',
  };

  return (
    <Badge className={colorMap[status] ?? 'bg-muted text-muted-foreground'}>
      {t(`statuses.${status}`)}
    </Badge>
  );
}

function OverviewTab({
  project,
  deliveryLocations,
  storageLocations,
  t,
}: {
  project: ProjectDetail;
  deliveryLocations: ProjectLocationResponse[];
  storageLocations: ProjectLocationResponse[];
  t: TranslationFn;
}) {
  const formatCurrency = (amount: number | null, currency: string) => {
    if (amount === null || amount === undefined) return t('detail.notSet');
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Project Info */}
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <InfoField label={t('detail.type')} value={project.type ?? t('detail.notSet')} />
          <InfoField
            label={t('detail.budget')}
            value={formatCurrency(project.plannedBudget, project.currency)}
          />
          <InfoField
            label={t('detail.usedBudget')}
            value={formatCurrency(project.usedBudget, project.currency)}
          />
          <InfoField
            label={t('detail.startDate')}
            value={
              project.startDate
                ? new Date(project.startDate).toLocaleDateString()
                : t('detail.notSet')
            }
          />
          <InfoField
            label={t('detail.expectedEndDate')}
            value={
              project.expectedEndDate
                ? new Date(project.expectedEndDate).toLocaleDateString()
                : t('detail.notSet')
            }
          />
          <InfoField label={t('detail.currency')} value={project.currency} />
          <InfoField
            label={t('detail.pointOfContact')}
            value={project.pointOfContact?.name ?? t('detail.notSet')}
          />
          <InfoField label={t('detail.createdBy')} value={project.createdBy.name} />
          <InfoField
            label={t('detail.createdAt')}
            value={new Date(project.createdAt).toLocaleDateString()}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t('detail.rfqs')} value={project.rfqCount} />
        <StatCard label={t('detail.purchaseOrders')} value={project.poCount} />
        <StatCard label={t('detail.invoices')} value={project.invoiceCount} />
        <StatCard label={t('detail.vendors')} value={project.vendorCount} />
      </div>

      {/* Locations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            {t('detail.deliveryLocations')}
          </h3>
          <div className="space-y-2">
            {deliveryLocations.map((loc) => (
              <div key={loc.id} className="text-sm">
                <span className="text-foreground">{loc.address}</span>
                {loc.label && <span className="text-muted-foreground ml-2">({loc.label})</span>}
                {loc.isDefault && (
                  <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    {t('detail.defaultBadge')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            {t('detail.storageLocations')}
          </h3>
          <div className="space-y-2">
            {storageLocations.map((loc) => (
              <div key={loc.id} className="text-sm">
                <span className="text-foreground">{loc.address}</span>
                {loc.label && <span className="text-muted-foreground ml-2">({loc.label})</span>}
                {loc.isDefault && (
                  <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    {t('detail.defaultBadge')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}

function MembersTab({
  project,
  canManageProject,
  onAdd,
  onRemove,
  t,
}: {
  project: ProjectDetail;
  canManageProject: boolean;
  onAdd: () => void;
  onRemove: (member: { id: string; name: string }) => void;
  t: TranslationFn;
}) {
  return (
    <div>
      {canManageProject && (
        <div className="flex justify-end mb-4">
          <Button onClick={onAdd}>{t('detail.addMembers')}</Button>
        </div>
      )}

      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-border text-left bg-[hsl(var(--table-header))] font-['Inter'] text-[hsl(var(--table-header-foreground))]">
            <th className="px-4 py-3 text-xs font-bold leading-4 tracking-[0.6px]">
              {t('detail.memberColumns.name')}
            </th>
            <th className="px-4 py-3 text-xs font-bold leading-4 tracking-[0.6px]">
              {t('detail.memberColumns.email')}
            </th>
            <th className="px-4 py-3 text-xs font-bold leading-4 tracking-[0.6px]">
              {t('detail.memberColumns.role')}
            </th>
            <th className="px-4 py-3 text-xs font-bold leading-4 tracking-[0.6px]">
              {t('detail.memberColumns.assignedDate')}
            </th>
            {canManageProject && (
              <th className="px-4 py-3 text-xs font-bold leading-4 tracking-[0.6px]" />
            )}
          </tr>
        </thead>
        <tbody>
          {project.assignedUsers.map((member: ProjectMemberResponse) => (
            <tr key={member.id} className="border-b border-border">
              <td className="py-3 text-foreground">{member.name}</td>
              <td className="py-3 text-muted-foreground">{member.email}</td>
              <td className="py-3 text-muted-foreground">{member.role}</td>
              <td className="py-3 text-muted-foreground">
                {new Date(member.assignedAt).toLocaleDateString()}
              </td>
              {canManageProject && (
                <td className="py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onRemove({ id: member.id, name: member.name })}
                    className="text-xs text-destructive hover:underline"
                  >
                    {t('detail.removeMember')}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddMembersModal({
  projectId,
  existingMemberIds,
  onClose,
  t,
}: {
  projectId: string;
  existingMemberIds: string[];
  onClose: () => void;
  t: TranslationFn;
}) {
  const { data: companyUsers = [] } = useCompanyUsers();
  const addMutation = useAddProjectMembers(projectId);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const availableUsers = companyUsers.filter((u) => !existingMemberIds.includes(u.id));

  const handleAdd = () => {
    if (selectedIds.length === 0) return;
    addMutation.mutate(
      { userIds: selectedIds },
      {
        onSuccess: () => onClose(),
      },
    );
  };

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          {t('detail.addMembersModal.title')}
        </h3>

        {availableUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('detail.addMembersModal.noUsersAvailable')}
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
            {availableUsers.map((user) => (
              <Checkbox
                key={user.id}
                checked={selectedIds.includes(user.id)}
                onChange={(checked) => {
                  if (checked) {
                    setSelectedIds((prev) => [...prev, user.id]);
                  } else {
                    setSelectedIds((prev) => prev.filter((id) => id !== user.id));
                  }
                }}
                label={`${user.name} (${user.email})`}
              />
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            {t('edit.cancel')}
          </Button>
          <Button
            onClick={handleAdd}
            disabled={selectedIds.length === 0}
            isLoading={addMutation.isPending}
          >
            {addMutation.isPending
              ? t('detail.addMembersModal.adding')
              : t('detail.addMembersModal.add')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function RemoveConfirmDialog({
  projectId,
  member,
  onClose,
  t,
}: {
  projectId: string;
  member: { id: string; name: string };
  onClose: () => void;
  t: TranslationFn;
}) {
  const removeMutation = useRemoveProjectMember(projectId);

  const handleRemove = () => {
    removeMutation.mutate(member.id, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <ConfirmDialog
      title={t('detail.confirmRemoveTitle')}
      message={t('detail.confirmRemoveMessage', { name: member.name })}
      confirmLabel={t('detail.removeMember')}
      cancelLabel={t('edit.cancel')}
      confirmVariant="bg-destructive hover:bg-destructive/90"
      onConfirm={handleRemove}
      onCancel={onClose}
    />
  );
}
