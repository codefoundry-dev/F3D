import { create } from 'zustand';

type StatusAction = 'activate' | 'deactivate';

interface UsersState {
  // Create user modal
  isCreateModalOpen: boolean;
  openCreateModal: () => void;
  closeCreateModal: () => void;

  // Edit modal
  isEditModalOpen: boolean;
  editUserId: string | null;
  openEditModal: (userId: string) => void;
  closeEditModal: () => void;

  // Status action modal (activate/deactivate confirmation)
  isStatusActionModalOpen: boolean;
  statusActionType: StatusAction | null;
  statusActionUserId: string | null;
  statusActionUserEmail: string | null;
  openStatusActionModal: (type: StatusAction, userId: string, email: string) => void;
  closeStatusActionModal: () => void;

  // Status success modal
  isStatusSuccessModalOpen: boolean;
  statusSuccessType: StatusAction | null;
  statusSuccessUserEmail: string | null;
  openStatusSuccessModal: (type: StatusAction, email: string) => void;
  closeStatusSuccessModal: () => void;

  // Reset password modal
  isResetPasswordModalOpen: boolean;
  resetPasswordUserId: string | null;
  resetPasswordUserEmail: string | null;
  openResetPasswordModal: (userId: string, email: string) => void;
  closeResetPasswordModal: () => void;

  // Reset password success modal
  isResetPasswordSuccessModalOpen: boolean;
  resetPasswordSuccessEmail: string | null;
  openResetPasswordSuccessModal: (email: string) => void;
  closeResetPasswordSuccessModal: () => void;

  // Cancel invitation modal
  isCancelInvitationModalOpen: boolean;
  cancelInvitationUserId: string | null;
  cancelInvitationUserEmail: string | null;
  cancelInvitationUserName: string | null;
  openCancelInvitationModal: (userId: string, email: string, name: string) => void;
  closeCancelInvitationModal: () => void;

  // Edit company modal
  isEditCompanyModalOpen: boolean;
  editCompanyId: string | null;
  editCompanyName: string | null;
  openEditCompanyModal: (companyId: string, companyName: string) => void;
  closeEditCompanyModal: () => void;

  // Bulk action modal (deactivate/activate all users in a company)
  isBulkActionModalOpen: boolean;
  bulkActionType: StatusAction | null;
  bulkActionCompanyName: string | null;
  bulkActionUserIds: string[];
  openBulkActionModal: (type: StatusAction, companyName: string, userIds: string[]) => void;
  closeBulkActionModal: () => void;

  // Company group expand/collapse
  expandedCompanyIds: string[];
  toggleCompany: (companyId: string) => void;
  expandAll: (companyIds: string[]) => void;
  collapseAll: () => void;
}

export const useUsersStore = create<UsersState>((set) => ({
  // Create user modal
  isCreateModalOpen: false,
  openCreateModal: () => set({ isCreateModalOpen: true }),
  closeCreateModal: () => set({ isCreateModalOpen: false }),

  // Edit modal
  isEditModalOpen: false,
  editUserId: null,
  openEditModal: (userId) => set({ isEditModalOpen: true, editUserId: userId }),
  closeEditModal: () => set({ isEditModalOpen: false, editUserId: null }),

  // Status action modal
  isStatusActionModalOpen: false,
  statusActionType: null,
  statusActionUserId: null,
  statusActionUserEmail: null,
  openStatusActionModal: (type, userId, email) =>
    set({
      isStatusActionModalOpen: true,
      statusActionType: type,
      statusActionUserId: userId,
      statusActionUserEmail: email,
    }),
  closeStatusActionModal: () =>
    set({
      isStatusActionModalOpen: false,
      statusActionType: null,
      statusActionUserId: null,
      statusActionUserEmail: null,
    }),

  // Status success modal
  isStatusSuccessModalOpen: false,
  statusSuccessType: null,
  statusSuccessUserEmail: null,
  openStatusSuccessModal: (type, email) =>
    set({
      isStatusSuccessModalOpen: true,
      statusSuccessType: type,
      statusSuccessUserEmail: email,
    }),
  closeStatusSuccessModal: () =>
    set({
      isStatusSuccessModalOpen: false,
      statusSuccessType: null,
      statusSuccessUserEmail: null,
    }),

  // Reset password modal
  isResetPasswordModalOpen: false,
  resetPasswordUserId: null,
  resetPasswordUserEmail: null,
  openResetPasswordModal: (userId, email) =>
    set({
      isResetPasswordModalOpen: true,
      resetPasswordUserId: userId,
      resetPasswordUserEmail: email,
    }),
  closeResetPasswordModal: () =>
    set({
      isResetPasswordModalOpen: false,
      resetPasswordUserId: null,
      resetPasswordUserEmail: null,
    }),

  // Reset password success modal
  isResetPasswordSuccessModalOpen: false,
  resetPasswordSuccessEmail: null,
  openResetPasswordSuccessModal: (email) =>
    set({ isResetPasswordSuccessModalOpen: true, resetPasswordSuccessEmail: email }),
  closeResetPasswordSuccessModal: () =>
    set({ isResetPasswordSuccessModalOpen: false, resetPasswordSuccessEmail: null }),

  // Cancel invitation modal
  isCancelInvitationModalOpen: false,
  cancelInvitationUserId: null,
  cancelInvitationUserEmail: null,
  cancelInvitationUserName: null,
  openCancelInvitationModal: (userId, email, name) =>
    set({
      isCancelInvitationModalOpen: true,
      cancelInvitationUserId: userId,
      cancelInvitationUserEmail: email,
      cancelInvitationUserName: name,
    }),
  closeCancelInvitationModal: () =>
    set({
      isCancelInvitationModalOpen: false,
      cancelInvitationUserId: null,
      cancelInvitationUserEmail: null,
      cancelInvitationUserName: null,
    }),

  // Edit company modal
  isEditCompanyModalOpen: false,
  editCompanyId: null,
  editCompanyName: null,
  openEditCompanyModal: (companyId, companyName) =>
    set({ isEditCompanyModalOpen: true, editCompanyId: companyId, editCompanyName: companyName }),
  closeEditCompanyModal: () =>
    set({ isEditCompanyModalOpen: false, editCompanyId: null, editCompanyName: null }),

  // Bulk action modal
  isBulkActionModalOpen: false,
  bulkActionType: null,
  bulkActionCompanyName: null,
  bulkActionUserIds: [],
  openBulkActionModal: (type, companyName, userIds) =>
    set({
      isBulkActionModalOpen: true,
      bulkActionType: type,
      bulkActionCompanyName: companyName,
      bulkActionUserIds: userIds,
    }),
  closeBulkActionModal: () =>
    set({
      isBulkActionModalOpen: false,
      bulkActionType: null,
      bulkActionCompanyName: null,
      bulkActionUserIds: [],
    }),

  // Company group expand/collapse
  expandedCompanyIds: [],
  toggleCompany: (companyId) =>
    set((state) => ({
      expandedCompanyIds: state.expandedCompanyIds.includes(companyId)
        ? state.expandedCompanyIds.filter((id) => id !== companyId)
        : [...state.expandedCompanyIds, companyId],
    })),
  expandAll: (companyIds) => set({ expandedCompanyIds: companyIds }),
  collapseAll: () => set({ expandedCompanyIds: [] }),
}));
