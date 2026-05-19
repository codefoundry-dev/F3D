import { create } from 'zustand';

type VendorAction =
  | 'cancelInvitation'
  | 'resetInvitation'
  | 'archiveVendor'
  | 'archiveVendors'
  | 'deactivateVendor';

interface VendorsState {
  // Action modal (cancel invitation, reset invitation, archive vendor, archive vendors)
  isActionModalOpen: boolean;
  actionType: VendorAction | null;
  actionUserId: string | null;
  actionUserIds: string[] | null;
  actionUserEmail: string | null;
  actionUserName: string | null;
  actionCompanyName: string | null;
  openActionModal: (type: VendorAction, userId: string, email: string, name: string) => void;
  openBulkActionModal: (type: VendorAction, userIds: string[], companyName: string) => void;
  closeActionModal: () => void;

  // Edit vendor user modal
  isEditModalOpen: boolean;
  editVendorUserId: string | null;
  openEditModal: (userId: string) => void;
  closeEditModal: () => void;

  // Success modal
  isSuccessModalOpen: boolean;
  successType: VendorAction | null;
  successUserEmail: string | null;
  successCompanyName: string | null;
  openSuccessModal: (type: VendorAction, email: string) => void;
  openBulkSuccessModal: (type: VendorAction, companyName: string) => void;
  closeSuccessModal: () => void;
}

export const useVendorsStore = create<VendorsState>((set) => ({
  // Action modal
  isActionModalOpen: false,
  actionType: null,
  actionUserId: null,
  actionUserIds: null,
  actionUserEmail: null,
  actionUserName: null,
  actionCompanyName: null,
  openActionModal: (type, userId, email, name) =>
    set({
      isActionModalOpen: true,
      actionType: type,
      actionUserId: userId,
      actionUserIds: null,
      actionUserEmail: email,
      actionUserName: name,
      actionCompanyName: null,
    }),
  openBulkActionModal: (type, userIds, companyName) =>
    set({
      isActionModalOpen: true,
      actionType: type,
      actionUserId: null,
      actionUserIds: userIds,
      actionUserEmail: null,
      actionUserName: null,
      actionCompanyName: companyName,
    }),
  closeActionModal: () =>
    set({
      isActionModalOpen: false,
      actionType: null,
      actionUserId: null,
      actionUserIds: null,
      actionUserEmail: null,
      actionUserName: null,
      actionCompanyName: null,
    }),

  // Edit vendor user modal
  isEditModalOpen: false,
  editVendorUserId: null,
  openEditModal: (userId) => set({ isEditModalOpen: true, editVendorUserId: userId }),
  closeEditModal: () => set({ isEditModalOpen: false, editVendorUserId: null }),

  // Success modal
  isSuccessModalOpen: false,
  successType: null,
  successUserEmail: null,
  successCompanyName: null,
  openSuccessModal: (type, email) =>
    set({
      isSuccessModalOpen: true,
      successType: type,
      successUserEmail: email,
      successCompanyName: null,
    }),
  openBulkSuccessModal: (type, companyName) =>
    set({
      isSuccessModalOpen: true,
      successType: type,
      successUserEmail: null,
      successCompanyName: companyName,
    }),
  closeSuccessModal: () =>
    set({
      isSuccessModalOpen: false,
      successType: null,
      successUserEmail: null,
      successCompanyName: null,
    }),
}));
