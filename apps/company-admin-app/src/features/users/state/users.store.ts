import { create } from 'zustand';

type StatusAction = 'activate' | 'deactivate';

interface UsersState {
  isCreateModalOpen: boolean;
  isSuccessModalOpen: boolean;
  createdUserEmail: string | null;
  isEditModalOpen: boolean;
  editUserId: string | null;
  isStatusActionModalOpen: boolean;
  statusActionType: StatusAction | null;
  statusActionUserId: string | null;
  statusActionUserEmail: string | null;
  isStatusSuccessModalOpen: boolean;
  statusSuccessType: StatusAction | null;
  statusSuccessUserEmail: string | null;
  isResetPasswordModalOpen: boolean;
  resetPasswordUserId: string | null;
  resetPasswordUserEmail: string | null;
  isResetPasswordSuccessModalOpen: boolean;
  resetPasswordSuccessEmail: string | null;
  isCancelInvitationModalOpen: boolean;
  cancelInvitationUserId: string | null;
  cancelInvitationUserEmail: string | null;
  cancelInvitationUserName: string | null;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  openSuccessModal: (email: string) => void;
  closeSuccessModal: () => void;
  openEditModal: (userId: string) => void;
  closeEditModal: () => void;
  openStatusActionModal: (type: StatusAction, userId: string, email: string) => void;
  closeStatusActionModal: () => void;
  openStatusSuccessModal: (type: StatusAction, email: string) => void;
  closeStatusSuccessModal: () => void;
  openResetPasswordModal: (userId: string, email: string) => void;
  closeResetPasswordModal: () => void;
  openResetPasswordSuccessModal: (email: string) => void;
  closeResetPasswordSuccessModal: () => void;
  openCancelInvitationModal: (userId: string, email: string, name: string) => void;
  closeCancelInvitationModal: () => void;
}

export const useUsersStore = create<UsersState>((set) => ({
  isCreateModalOpen: false,
  isSuccessModalOpen: false,
  createdUserEmail: null,
  isEditModalOpen: false,
  editUserId: null,
  isStatusActionModalOpen: false,
  statusActionType: null,
  statusActionUserId: null,
  statusActionUserEmail: null,
  isStatusSuccessModalOpen: false,
  statusSuccessType: null,
  statusSuccessUserEmail: null,
  isResetPasswordModalOpen: false,
  resetPasswordUserId: null,
  resetPasswordUserEmail: null,
  isResetPasswordSuccessModalOpen: false,
  resetPasswordSuccessEmail: null,
  isCancelInvitationModalOpen: false,
  cancelInvitationUserId: null,
  cancelInvitationUserEmail: null,
  cancelInvitationUserName: null,

  openCreateModal: () => set({ isCreateModalOpen: true }),
  closeCreateModal: () => set({ isCreateModalOpen: false }),

  openSuccessModal: (email) => set({ isSuccessModalOpen: true, createdUserEmail: email }),
  closeSuccessModal: () => set({ isSuccessModalOpen: false, createdUserEmail: null }),

  openEditModal: (userId) => set({ isEditModalOpen: true, editUserId: userId }),
  closeEditModal: () => set({ isEditModalOpen: false, editUserId: null }),

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

  openResetPasswordSuccessModal: (email) =>
    set({ isResetPasswordSuccessModalOpen: true, resetPasswordSuccessEmail: email }),
  closeResetPasswordSuccessModal: () =>
    set({ isResetPasswordSuccessModalOpen: false, resetPasswordSuccessEmail: null }),

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
}));
