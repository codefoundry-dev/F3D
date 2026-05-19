import { useVendorUsersStore } from './vendor-users.store';

describe('useVendorUsersStore', () => {
  beforeEach(() => {
    const { getState } = useVendorUsersStore;
    getState().closeInviteModal();
    getState().closeSuccessModal();
    getState().closeUserExistsModal();
    getState().closeStatusActionModal();
  });

  it('opens and closes invite modal', () => {
    const store = useVendorUsersStore.getState();
    expect(store.isInviteModalOpen).toBe(false);
    store.openInviteModal();
    expect(useVendorUsersStore.getState().isInviteModalOpen).toBe(true);
    store.closeInviteModal();
    expect(useVendorUsersStore.getState().isInviteModalOpen).toBe(false);
  });

  it('opens success modal with email and closes it', () => {
    const store = useVendorUsersStore.getState();
    store.openSuccessModal('test@example.com');
    const state = useVendorUsersStore.getState();
    expect(state.isSuccessModalOpen).toBe(true);
    expect(state.invitedUserEmail).toBe('test@example.com');
    store.closeSuccessModal();
    const closed = useVendorUsersStore.getState();
    expect(closed.isSuccessModalOpen).toBe(false);
    expect(closed.invitedUserEmail).toBeNull();
  });

  it('opens and closes user exists modal', () => {
    const store = useVendorUsersStore.getState();
    store.openUserExistsModal();
    expect(useVendorUsersStore.getState().isUserExistsModalOpen).toBe(true);
    store.closeUserExistsModal();
    expect(useVendorUsersStore.getState().isUserExistsModalOpen).toBe(false);
  });

  it('opens status action modal with type, userId, email', () => {
    const store = useVendorUsersStore.getState();
    store.openStatusActionModal('deactivate', 'user-1', 'user@example.com');
    const state = useVendorUsersStore.getState();
    expect(state.isStatusActionModalOpen).toBe(true);
    expect(state.statusActionType).toBe('deactivate');
    expect(state.statusActionUserId).toBe('user-1');
    expect(state.statusActionUserEmail).toBe('user@example.com');
  });

  it('closes status action modal and resets fields', () => {
    const store = useVendorUsersStore.getState();
    store.openStatusActionModal('activate', 'user-2', 'u@e.com');
    store.closeStatusActionModal();
    const state = useVendorUsersStore.getState();
    expect(state.isStatusActionModalOpen).toBe(false);
    expect(state.statusActionType).toBeNull();
    expect(state.statusActionUserId).toBeNull();
    expect(state.statusActionUserEmail).toBeNull();
  });

  it('opens cancel invitation via status action modal', () => {
    const store = useVendorUsersStore.getState();
    store.openStatusActionModal('cancelInvitation', 'user-3', 'cancel@e.com');
    const state = useVendorUsersStore.getState();
    expect(state.isStatusActionModalOpen).toBe(true);
    expect(state.statusActionType).toBe('cancelInvitation');
    expect(state.statusActionUserId).toBe('user-3');
    expect(state.statusActionUserEmail).toBe('cancel@e.com');
  });
});
