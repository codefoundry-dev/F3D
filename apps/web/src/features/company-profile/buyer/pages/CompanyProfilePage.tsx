import {
  getCompany,
  getUsers,
  deactivateUser as deactivateUserApi,
  reactivateUser as reactivateUserApi,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { UserStatus } from '@forethread/shared-types/client';
import {
  Spinner,
  Button,
  Tabs,
  DotActionsMenu,
  StatusActionModal,
  notificationService,
  type DotAction,
  type TabItem,
} from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import DepartmentIcon from '@forethread/ui-components/assets/icons/department.svg?react';
import FileTextIcon from '@forethread/ui-components/assets/icons/file-text.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import UsersGroupIcon from '@forethread/ui-components/assets/icons/users-group.svg?react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuthStore } from '@/features/auth/state/auth.store';
import { CompanyProfileHeaderCard } from '@/features/companies/ui/CompanyProfileHeaderCard';
import { DocumentsTab } from '@/features/companies/ui/DocumentsTab';
import { EditCompanyDetailsModal } from '@/features/companies/ui/EditCompanyDetailsModal';
import { OverviewTab } from '@/features/companies/ui/OverviewTab';
import { useUsersStore } from '@/features/users/company-admin/state/users.store';
import { CreateUserModal } from '@/features/users/company-admin/ui/CreateUserModal';
import { InvitationSuccessModal } from '@/features/users/company-admin/ui/InvitationSuccessModal';

import { BuyerCompanyUsersTab } from '../components/BuyerCompanyUsersTab';
import { useCompanyLogo } from '../hooks/useCompanyLogo';

const COMPANY_KEY = 'company-profile';

type Tab = 'overview' | 'companyUsers' | 'documents';

export default function CompanyProfilePage() {
  const { t } = useTranslation(['company', 'common', 'users']);
  const companyId = useAuthStore((s) => s.currentUser?.companyId);
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  const queryClient = useQueryClient();

  const { data: company, isLoading } = useQuery({
    queryKey: [COMPANY_KEY, companyId],
    queryFn: () => getCompany(companyId as string),
    enabled: Boolean(companyId),
  });

  const { logoUrl, inputRef, isPending, handleLogoChange, openFilePicker } = useCompanyLogo(
    companyId ?? undefined,
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs: Tab[] = ['overview', 'companyUsers', 'documents'];
  const tabParam = searchParams.get('tab') as Tab | null;
  const activeTab: Tab = tabParam && validTabs.includes(tabParam) ? tabParam : 'overview';
  const setActiveTab = useCallback(
    (tab: Tab) => setSearchParams({ tab }, { replace: true }),
    [setSearchParams],
  );

  const [isEditing, setIsEditing] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkType, setBulkType] = useState<'deactivate' | 'activate'>('deactivate');
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const {
    isCreateModalOpen,
    openCreateModal,
    closeCreateModal,
    isSuccessModalOpen,
    closeSuccessModal,
  } = useUsersStore();

  useEffect(() => {
    setPageTitle(t('companyDetails'), null, null, [{ label: t('companyDetails') }]);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  const { data: companyUsers } = useQuery({
    queryKey: ['users', { companyId }],
    queryFn: () => getUsers({ companyId: companyId as string, limit: 500 }),
    enabled: Boolean(companyId),
    select: (d) => d.items,
  });

  const activeUsers = companyUsers?.filter((u) => u.status === UserStatus.ACTIVE) ?? [];
  const inactiveUsers = companyUsers?.filter((u) => u.status === UserStatus.INACTIVE) ?? [];
  const allActive = activeUsers.length > 0 && inactiveUsers.length === 0;

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

  const tabs: TabItem<Tab>[] = [
    {
      value: 'overview',
      label: t('tabs.companyOverview'),
      icon: <InfoIcon className="size-[18px]" />,
    },
    {
      value: 'companyUsers',
      label: t('tabs.companyUsers'),
      icon: <UsersGroupIcon className="size-[18px]" />,
    },
    {
      value: 'documents',
      label: t('tabs.documents'),
      icon: <FileTextIcon className="size-[18px]" />,
    },
  ];

  const dotActions: DotAction[] = [
    { key: 'edit', label: t('editCompanyDetails'), onClick: () => setIsEditing(true) },
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
    <div className="flex flex-1 flex-col gap-4 px-6 py-4">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white p-px text-gray-700 shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]">
          <DepartmentIcon className="size-[15px]" />
        </span>
        <h1 className="text-[20px] font-medium leading-[1.4] tracking-[0.3px] text-gray-900">
          {t('companyDetails')}
        </h1>
      </div>

      {/* Hidden logo upload input (triggered by the avatar) */}
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.svg"
        className="hidden"
        onChange={handleLogoChange}
      />

      {/* Company header card */}
      <CompanyProfileHeaderCard
        company={company}
        logoUrl={logoUrl}
        activeCount={activeUsers.length}
        inactiveCount={inactiveUsers.length}
        onAvatarClick={openFilePicker}
        isUploadingLogo={isPending}
        actions={
          <>
            <Button onClick={openCreateModal} leftIcon={<NewUserIcon className="size-5" />}>
              {t('users:inviteUser')}
            </Button>
            <DotActionsMenu actions={dotActions} />
          </>
        }
      />

      {/* Tabs */}
      <Tabs items={tabs} value={activeTab} onValueChange={setActiveTab} />

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && <OverviewTab company={company} />}
        {activeTab === 'companyUsers' && <BuyerCompanyUsersTab />}
        {activeTab === 'documents' && <DocumentsTab companyId={company.id} />}
      </div>

      {/* Edit company details modal */}
      {isEditing && (
        <EditCompanyDetailsModal company={company} onClose={() => setIsEditing(false)} />
      )}

      {/* Invite user modals (opened from the header) */}
      {isCreateModalOpen && <CreateUserModal onClose={closeCreateModal} />}
      {isSuccessModalOpen && <InvitationSuccessModal onClose={closeSuccessModal} />}

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
