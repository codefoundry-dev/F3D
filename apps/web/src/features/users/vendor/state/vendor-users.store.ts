import { create } from 'zustand';

type StatusAction = 'activate' | 'deactivate' | 'resendInvitation' | 'cancelInvitation';

interface VendorUsersState {
  isInviteModalOpen: boolean;
  isSuccessModalOpen: boolean;
  invitedUserEmail: string | null;
  isUserExistsModalOpen: boolean;
  isEditModalOpen: boolean;
  editUserId: string | null;
  isStatusActionModalOpen: boolean;
  statusActionType: StatusAction | null;
  statusActionUserId: string | null;
  statusActionUserEmail: string | null;
  openInviteModal: () => void;
  closeInviteModal: () => void;
  openSuccessModal: (email: string) => void;
  closeSuccessModal: () => void;
  openUserExistsModal: () => void;
  closeUserExistsModal: () => void;
  openEditModal: (userId: string) => void;
  closeEditModal: () => void;
  openStatusActionModal: (type: StatusAction, userId: string, email: string) => void;
  closeStatusActionModal: () => void;
}

export const useVendorUsersStore = create<VendorUsersState>((set) => ({
  isInviteModalOpen: false,
  isSuccessModalOpen: false,
  invitedUserEmail: null,
  isUserExistsModalOpen: false,
  isEditModalOpen: false,
  editUserId: null,
  isStatusActionModalOpen: false,
  statusActionType: null,
  statusActionUserId: null,
  statusActionUserEmail: null,
  openInviteModal: () => set({ isInviteModalOpen: true }),
  closeInviteModal: () => set({ isInviteModalOpen: false }),

  openSuccessModal: (email) => set({ isSuccessModalOpen: true, invitedUserEmail: email }),
  closeSuccessModal: () => set({ isSuccessModalOpen: false, invitedUserEmail: null }),

  openUserExistsModal: () => set({ isUserExistsModalOpen: true }),
  closeUserExistsModal: () => set({ isUserExistsModalOpen: false }),

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
}));
