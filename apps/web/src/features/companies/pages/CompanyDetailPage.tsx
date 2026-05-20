import {
  deactivateUser as deactivateUserApi,
  reactivateUser as reactivateUserApi,
  getUsers,
  updateCompany,
  type UpdateCompanyDto,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { CompanyType, UserStatus } from '@forethread/shared-types/client';
import {
  cn,
  Spinner,
  Button,
  DotActionsMenu,
  StatusActionModal,
  Alert,
  notificationService,
  type DotAction,
} from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { useCompany } from '../services/companies.service';
import { CompanyUsersTab } from '../ui/CompanyUsersTab';
import { DocumentsTab } from '../ui/DocumentsTab';
import { OverviewTab } from '../ui/OverviewTab';

type Tab = 'overview' | 'companyUsers' | 'documents';

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation(['company', 'common', 'users']);
  const { data: company, isLoading } = useCompany(id ?? '');
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs: Tab[] = ['overview', 'companyUsers', 'documents'];
  const tabParam = searchParams.get('tab') as Tab | null;
  const activeTab: Tab = tabParam && validTabs.includes(tabParam) ? tabParam : 'overview';
  const setActiveTab = useCallback(
    (tab: Tab) => setSearchParams({ tab }, { replace: true }),
    [setSearchParams],
  );
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkType, setBulkType] = useState<'deactivate' | 'activate'>('deactivate');
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const queryClient = useQueryClient();

  const { data: companyUsers } = useQuery({
    queryKey: ['users', { companyId: id }],
    queryFn: () => getUsers({ companyId: id, limit: 500 }),
    enabled: !!id,
    select: (d) => d.items,
  });

  const updateMutation = useMutation({
    mutationFn: (dto: UpdateCompanyDto) => {
      if (!company) throw new Error('Company not loaded');
      return updateCompany(company.id, dto);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['companies'] });
      setIsEditing(false);
    },
  });

  const activeUsers = companyUsers?.filter((u) => u.status === UserStatus.ACTIVE) ?? [];
  const inactiveUsers = companyUsers?.filter((u) => u.status === UserStatus.INACTIVE) ?? [];
  const allActive = activeUsers.length > 0 && inactiveUsers.length === 0;

  const handleEdit = () => {
    if (!company) return;
    setFormData({
      legalName: company.legalName || '',
      tradeName: company.tradeName ?? '',
      abn: company.abn ?? '',
      taxCode: company.taxCode ?? '',
      legalAddress: company.legalAddress ?? '',
      contactEmail: company.contactEmail ?? '',
      contactPhone: company.contactPhone ?? '',
      website: company.website ?? '',
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    updateMutation.reset();
  };

  const handleSubmit = () => {
    const emptyToUndefined = (v: string | undefined) =>
      v === '' || v === null || v === undefined ? undefined : v;
    updateMutation.mutate({
      legalName: formData.legalName,
      tradeName: emptyToUndefined(formData.tradeName),
      legalAddress: emptyToUndefined(formData.legalAddress),
      contactEmail: emptyToUndefined(formData.contactEmail),
      contactPhone: emptyToUndefined(formData.contactPhone),
      website: emptyToUndefined(formData.website),
    });
  };

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleBulkAction = async () => {
    const userIds =
      bulkType === 'deactivate' ? activeUsers.map((u) => u.id) : inactiveUsers.map((u) => u.id);
    if (!userIds.length) return;
    setIsBulkLoading(true);
    const apiFn = bulkType === 'deactivate' ? deactivateUserApi : reactivateUserApi;
    try {
      const results = await Promise.allSettled(userIds.map((uid) => apiFn(uid)));
      const failures = results.filter((r) => r.status === 'rejected');
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsBulkModalOpen(false);
      if (failures.length > 0) {
        notificationService.error(t('users:bulkActionPartialError'));
      } else {
        notificationService.success(
          bulkType === 'deactivate'
            ? t('users:bulkDeactivateSuccess', { company: company?.legalName })
            : t('users:bulkActivateSuccess', { company: company?.legalName }),
        );
      }
    } finally {
      setIsBulkLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner size="md" />
      </div>
    );
  }

  if (!company) return null;

  const initials = company.legalName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: t('tabs.overview') },
    { key: 'companyUsers', label: t('tabs.companyUsers') },
    { key: 'documents', label: t('tabs.documents') },
  ];

  const dotActions: DotAction[] = [
    ...(isEditing
      ? []
      : [
          {
            key: 'edit',
            label: t('editCompanyDetails'),
            onClick: handleEdit,
          },
        ]),
    {
      key: 'bulkAction',
      label: allActive ? t('deactivateAllUsers') : t('activateAllUsers'),
      onClick: () => {
        setBulkType(allActive ? 'deactivate' : 'activate');
        setIsBulkModalOpen(true);
      },
    },
  ];

  return (
    <div className="p-6">
      {/* Tabs */}
      <div className="flex gap-0 border-b border-border px-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-3 text-sm font-medium transition-colors relative',
              activeTab === tab.key
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground" />
            )}
          </button>
        ))}
      </div>

      {/* Card with company header + tab content */}
      <div className="rounded-xl border border-border bg-card mt-6">
        {/* Company header */}
        <div className="px-8 py-6">
          <div className="flex items-center gap-5">
            {company.logoUrl ? (
              <img
                src={company.logoUrl}
                alt={company.legalName}
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-muted text-foreground flex items-center justify-center font-semibold text-lg">
                {initials}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-foreground">{company.legalName}</h2>
              {company.contactEmail && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                  <EnvelopeIcon className="w-4 h-4" />
                  <span>{company.contactEmail}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isEditing && activeTab === 'overview' && (
                <>
                  <Button
                    variant="primary"
                    onClick={handleSubmit}
                    isLoading={updateMutation.isPending}
                  >
                    {t('editModal.submit')}
                  </Button>
                  <Button variant="outline" onClick={handleCancel}>
                    {t('common:cancel')}
                  </Button>
                </>
              )}
              <DotActionsMenu actions={dotActions} />
            </div>
          </div>
        </div>

        <hr className="border-border mx-6" />

        {/* Error alert */}
        {updateMutation.isError && (
          <div className="px-6 pt-4">
            <Alert variant="destructive">{t('editModal.updateError')}</Alert>
          </div>
        )}

        {/* Tab content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <OverviewTab
              company={company}
              isEditing={isEditing}
              formData={formData}
              onFieldChange={updateField}
            />
          )}
          {activeTab === 'companyUsers' && (
            <CompanyUsersTab
              companyId={company.id}
              companyName={company.legalName}
              companyType={company.type as CompanyType}
            />
          )}
          {activeTab === 'documents' && <DocumentsTab companyId={company.id} />}
        </div>
      </div>

      {/* Bulk deactivate/activate modal */}
      {isBulkModalOpen && (
        <StatusActionModal
          onClose={() => setIsBulkModalOpen(false)}
          onConfirm={() => void handleBulkAction()}
          isLoading={isBulkLoading}
          title={t(
            bulkType === 'deactivate'
              ? 'users:bulkDeactivateModal.title'
              : 'users:bulkActivateModal.title',
          )}
          subtitle={t(
            bulkType === 'deactivate'
              ? 'users:bulkDeactivateModal.subtitle'
              : 'users:bulkActivateModal.subtitle',
          )}
          infoText={
            <span
              dangerouslySetInnerHTML={{
                __html: t(
                  bulkType === 'deactivate'
                    ? 'users:bulkDeactivateModal.info'
                    : 'users:bulkActivateModal.info',
                  {
                    company: company.legalName,
                    interpolation: { escapeValue: false },
                  },
                ),
              }}
            />
          }
          confirmLabel={t(
            bulkType === 'deactivate'
              ? 'users:bulkDeactivateModal.confirm'
              : 'users:bulkActivateModal.confirm',
          )}
          cancelLabel={t('common:cancel')}
          variant={bulkType === 'deactivate' ? 'danger' : 'default'}
          icon={
            bulkType === 'deactivate' ? (
              <CrossInCircleIcon className="w-6 h-6 text-foreground" />
            ) : undefined
          }
        />
      )}
    </div>
  );
}
