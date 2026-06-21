import type {
  ProjectDetail,
  ProjectLocationResponse,
  ProjectMemberResponse,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { UserRole } from '@forethread/shared-types/client';
import {
  Spinner,
  Badge,
  Button,
  Checkbox,
  Modal,
  ConfirmDialog,
  AvatarWithStatus,
  EmptyState,
  DotActionsMenu,
  buttonVariants,
} from '@forethread/ui-components';
import FlagIcon from '@forethread/ui-components/assets/icons/flag.svg?react';
import PlusIcon from '@forethread/ui-components/assets/icons/plus.svg?react';
import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
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

type Tab = 'details' | 'bom' | 'procurement' | 'vendors' | 'financials';

const TABS: Tab[] = ['details', 'bom', 'procurement', 'vendors', 'financials'];

const DATE_FORMAT: Intl.DateTimeFormatOptions = { month: 'short', day: '2-digit', year: 'numeric' };

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-US', DATE_FORMAT);
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t: tRaw } = useTranslation('projects');
  const t = tRaw as TranslationFn;
  const currentUser = useAuthStore((s) => s.currentUser);
  const { data: project, isLoading, isError } = useProject(id ?? '');

  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(t('detail.title'), null, ROUTES.projects);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const activeTab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'details';
  const setActiveTab = useCallback(
    (tab: Tab) => setSearchParams({ tab }, { replace: true }),
    [setSearchParams],
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);

  // Both COMPANY_ADMIN and PROCUREMENT_OFFICER manage projects in the unified app.
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

  return (
    <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-8">
      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <nav className="flex gap-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-semibold leading-none tracking-[0.3px] border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(`detail.tabs.${tab}`)}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'details' && (
        <DetailsTab
          project={project}
          projectId={id ?? ''}
          canManageProject={canManageProject}
          onAddMembers={() => setShowAddModal(true)}
          onRemoveMember={(member) => setConfirmRemove({ id: member.id, name: member.name })}
          t={t}
        />
      )}

      {activeTab === 'bom' && <BomTab projectId={id ?? ''} />}

      {activeTab === 'procurement' && (
        <ComingSoon
          title={t('detail.comingSoon.title')}
          description={t('detail.comingSoon.procurement')}
        />
      )}
      {activeTab === 'vendors' && (
        <ComingSoon
          title={t('detail.comingSoon.title')}
          description={t('detail.comingSoon.vendors')}
        />
      )}
      {activeTab === 'financials' && (
        <ComingSoon
          title={t('detail.comingSoon.title')}
          description={t('detail.comingSoon.financials')}
        />
      )}

      {showAddModal && (
        <AddMembersModal
          projectId={id ?? ''}
          existingMemberIds={project.assignedUsers.map((m) => m.id)}
          onClose={() => setShowAddModal(false)}
          t={t}
        />
      )}

      {confirmRemove && (
        <RemoveConfirmDialog
          projectId={id ?? ''}
          member={confirmRemove}
          onClose={() => setConfirmRemove(null)}
          t={t}
        />
      )}
    </div>
  );
}

function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-card rounded-lg border border-border">
      <EmptyState title={title} description={description} />
    </div>
  );
}

// ── Details & Documents tab ──────────────────────────────────────────────────

function DetailsTab({
  project,
  projectId,
  canManageProject,
  onAddMembers,
  onRemoveMember,
  t,
}: {
  project: ProjectDetail;
  projectId: string;
  canManageProject: boolean;
  onAddMembers: () => void;
  onRemoveMember: (member: { id: string; name: string }) => void;
  t: TranslationFn;
}) {
  const { t: tRolesRaw } = useTranslation('roles');
  const tRoles = tRolesRaw as TranslationFn;
  const deliveryLocations = project.locations.filter((l) => l.type === 'DELIVERY');
  const storageLocations = project.locations.filter((l) => l.type === 'STORAGE');

  const formatCurrency = (amount: number | null, currency: string) => {
    if (amount === null || amount === undefined) return t('detail.notSet');
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <section className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-base font-bold text-foreground">{t('detail.basicInformation')}</h2>
          {canManageProject && (
            <Link
              to={ROUTES.projectEdit.replace(':id', projectId)}
              className={buttonVariants({ size: 'md' })}
            >
              {t('detail.editProject')}
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
          <InfoField label={t('detail.projectId')} value={project.code} />
          <InfoField label={t('detail.projectName')} value={project.name} />
          <InfoField
            label={t('detail.projectStatus')}
            value={
              <Badge className="bg-muted text-muted-foreground">
                {t(`statuses.${project.status}`)}
              </Badge>
            }
          />
          <InfoField label={t('detail.projectType')} value={project.type ?? t('detail.notSet')} />
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
            value={formatDate(project.startDate) ?? t('detail.notSet')}
          />
          <InfoField
            label={t('detail.expectedEndDate')}
            value={formatDate(project.expectedEndDate) ?? t('detail.notSet')}
          />
          <InfoField
            label={t('detail.pointOfContact')}
            value={project.pointOfContact?.name ?? t('detail.notSet')}
          />
          <InfoField label={t('detail.createdBy')} value={project.createdBy.name} />
          <InfoField
            label={t('detail.createdAt')}
            value={formatDate(project.createdAt) ?? t('detail.notSet')}
          />
        </div>

        {/* Locations */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-border pt-6">
          <LocationColumn
            title={t('detail.deliveryLocations')}
            locations={deliveryLocations}
            t={t}
          />
          <LocationColumn title={t('detail.storageLocations')} locations={storageLocations} t={t} />
        </div>
      </section>

      {/* Assigned users and roles */}
      <section className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-foreground">{t('detail.assignedUsersRoles')}</h2>
          {canManageProject && (
            <Button size="md" leftIcon={<PlusIcon className="w-4 h-4" />} onClick={onAddMembers}>
              {t('detail.addMembers')}
            </Button>
          )}
        </div>

        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))] text-left">
                {(['name', 'email', 'phone', 'role', 'status', 'dateJoined'] as const).map((c) => (
                  <th
                    key={c}
                    className="px-4 py-3 text-xs font-bold leading-4 tracking-[0.6px] whitespace-nowrap"
                  >
                    {t(`detail.memberColumns.${c}`)}
                  </th>
                ))}
                {canManageProject && (
                  <th className="px-4 py-3 text-xs font-bold leading-4 tracking-[0.6px] whitespace-nowrap">
                    {t('detail.memberColumns.actions')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {project.assignedUsers.map((member: ProjectMemberResponse) => (
                <tr key={member.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 text-foreground">
                      <AvatarWithStatus
                        name={member.name}
                        avatarUrl={member.avatarUrl}
                        workStatus={member.workStatus as never}
                        size={28}
                      />
                      {member.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{member.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{member.phone ?? '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {tRoles(`roleNames.${member.role}`)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className="bg-muted text-muted-foreground">{member.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(member.assignedAt) ?? '-'}
                  </td>
                  {canManageProject && (
                    <td className="px-4 py-3">
                      <DotActionsMenu
                        bordered={false}
                        actions={[
                          {
                            key: 'remove',
                            label: t('detail.removeMember'),
                            onClick: () => onRemoveMember({ id: member.id, name: member.name }),
                          },
                        ]}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Attached Documents — no backend yet */}
      {/* TODO(US5.04): wire ProjectDocument backend */}
      <section className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold text-foreground">{t('detail.attachedDocuments')}</h2>
          <div className="flex items-center gap-2">
            <Button
              size="md"
              variant="outline"
              leftIcon={<PlusIcon className="w-4 h-4" />}
              disabled
            >
              {t('detail.addDoc')}
            </Button>
            <Button size="md" variant="outline" disabled>
              {t('detail.exportAs')}
            </Button>
          </div>
        </div>
        <EmptyState title={t('detail.noDocuments')} description={t('detail.noDocumentsHint')} />
      </section>
    </div>
  );
}

function LocationColumn({
  title,
  locations,
  t,
}: {
  title: string;
  locations: ProjectLocationResponse[];
  t: TranslationFn;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      <div className="space-y-2">
        {locations.length === 0 && <p className="text-sm text-muted-foreground">-</p>}
        {locations.map((loc) => (
          <div key={loc.id} className="flex items-start gap-2 text-sm">
            {loc.isDefault && (
              <FlagIcon className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
            )}
            <span className="text-foreground">
              {loc.address}
              {loc.label && <span className="text-muted-foreground"> ({loc.label})</span>}
            </span>
            {loc.isDefault && (
              <span className="ml-1 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                {t('detail.defaultBadge')}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground mt-1">{value}</div>
    </div>
  );
}

// ── Member add / remove ──────────────────────────────────────────────────────

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
    addMutation.mutate({ userIds: selectedIds }, { onSuccess: () => onClose() });
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
                    setSelectedIds((prev) => prev.filter((uid) => uid !== user.id));
                  }
                }}
                label={`${user.name} (${user.email})`}
              />
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            {t('create.cancel')}
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
    removeMutation.mutate(member.id, { onSuccess: () => onClose() });
  };

  return (
    <ConfirmDialog
      title={t('detail.confirmRemoveTitle')}
      message={t('detail.confirmRemoveMessage', { name: member.name })}
      confirmLabel={t('detail.removeMember')}
      cancelLabel={t('create.cancel')}
      confirmVariant="bg-destructive hover:bg-destructive/90"
      onConfirm={handleRemove}
      onCancel={onClose}
    />
  );
}
