import { useUsersStore } from './users.store';

describe('useUsersStore', () => {
  beforeEach(() => {
    useUsersStore.setState({
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
    });
  });

  it('opens create modal', () => {
    useUsersStore.getState().openCreateModal();
    expect(useUsersStore.getState().isCreateModalOpen).toBe(true);
  });

  it('closes create modal', () => {
    useUsersStore.getState().openCreateModal();
    useUsersStore.getState().closeCreateModal();
    expect(useUsersStore.getState().isCreateModalOpen).toBe(false);
  });

  it('opens success modal with email', () => {
    useUsersStore.getState().openSuccessModal('test@test.com');
    expect(useUsersStore.getState().isSuccessModalOpen).toBe(true);
    expect(useUsersStore.getState().createdUserEmail).toBe('test@test.com');
  });

  it('closes success modal and clears email', () => {
    useUsersStore.getState().openSuccessModal('test@test.com');
    useUsersStore.getState().closeSuccessModal();
    expect(useUsersStore.getState().isSuccessModalOpen).toBe(false);
    expect(useUsersStore.getState().createdUserEmail).toBeNull();
  });

  it('opens edit modal with userId', () => {
    useUsersStore.getState().openEditModal('u1');
    expect(useUsersStore.getState().isEditModalOpen).toBe(true);
    expect(useUsersStore.getState().editUserId).toBe('u1');
  });

  it('closes edit modal and clears userId', () => {
    useUsersStore.getState().openEditModal('u1');
    useUsersStore.getState().closeEditModal();
    expect(useUsersStore.getState().isEditModalOpen).toBe(false);
    expect(useUsersStore.getState().editUserId).toBeNull();
  });

  it('opens status action modal', () => {
    useUsersStore.getState().openStatusActionModal('deactivate', 'u1', 'test@test.com');
    const state = useUsersStore.getState();
    expect(state.isStatusActionModalOpen).toBe(true);
    expect(state.statusActionType).toBe('deactivate');
    expect(state.statusActionUserId).toBe('u1');
    expect(state.statusActionUserEmail).toBe('test@test.com');
  });

  it('closes status action modal', () => {
    useUsersStore.getState().openStatusActionModal('deactivate', 'u1', 'test@test.com');
    useUsersStore.getState().closeStatusActionModal();
    const state = useUsersStore.getState();
    expect(state.isStatusActionModalOpen).toBe(false);
    expect(state.statusActionType).toBeNull();
    expect(state.statusActionUserId).toBeNull();
    expect(state.statusActionUserEmail).toBeNull();
  });

  it('opens status success modal', () => {
    useUsersStore.getState().openStatusSuccessModal('activate', 'test@test.com');
    const state = useUsersStore.getState();
    expect(state.isStatusSuccessModalOpen).toBe(true);
    expect(state.statusSuccessType).toBe('activate');
    expect(state.statusSuccessUserEmail).toBe('test@test.com');
  });

  it('closes status success modal', () => {
    useUsersStore.getState().openStatusSuccessModal('activate', 'test@test.com');
    useUsersStore.getState().closeStatusSuccessModal();
    const state = useUsersStore.getState();
    expect(state.isStatusSuccessModalOpen).toBe(false);
    expect(state.statusSuccessType).toBeNull();
  });

  it('opens reset password modal', () => {
    useUsersStore.getState().openResetPasswordModal('u1', 'test@test.com');
    const state = useUsersStore.getState();
    expect(state.isResetPasswordModalOpen).toBe(true);
    expect(state.resetPasswordUserId).toBe('u1');
  });

  it('closes reset password modal', () => {
    useUsersStore.getState().openResetPasswordModal('u1', 'test@test.com');
    useUsersStore.getState().closeResetPasswordModal();
    expect(useUsersStore.getState().isResetPasswordModalOpen).toBe(false);
  });

  it('opens reset password success modal', () => {
    useUsersStore.getState().openResetPasswordSuccessModal('test@test.com');
    expect(useUsersStore.getState().isResetPasswordSuccessModalOpen).toBe(true);
    expect(useUsersStore.getState().resetPasswordSuccessEmail).toBe('test@test.com');
  });

  it('closes reset password success modal', () => {
    useUsersStore.getState().openResetPasswordSuccessModal('test@test.com');
    useUsersStore.getState().closeResetPasswordSuccessModal();
    expect(useUsersStore.getState().isResetPasswordSuccessModalOpen).toBe(false);
  });

  it('opens cancel invitation modal', () => {
    useUsersStore.getState().openCancelInvitationModal('u1', 'test@test.com', 'John');
    const state = useUsersStore.getState();
    expect(state.isCancelInvitationModalOpen).toBe(true);
    expect(state.cancelInvitationUserId).toBe('u1');
    expect(state.cancelInvitationUserEmail).toBe('test@test.com');
    expect(state.cancelInvitationUserName).toBe('John');
  });

  it('closes cancel invitation modal', () => {
    useUsersStore.getState().openCancelInvitationModal('u1', 'test@test.com', 'John');
    useUsersStore.getState().closeCancelInvitationModal();
    const state = useUsersStore.getState();
    expect(state.isCancelInvitationModalOpen).toBe(false);
    expect(state.cancelInvitationUserId).toBeNull();
  });
});
