import { useUsersStore } from './users.store';

const initialState = useUsersStore.getState();

beforeEach(() => {
  useUsersStore.setState(initialState, true);
});

describe('useUsersStore', () => {
  // ── Create Modal ──────────────────────────────────────────────────────

  describe('Create Modal', () => {
    it('should start with the create modal closed', () => {
      expect(useUsersStore.getState().isCreateModalOpen).toBe(false);
    });

    it('openCreateModal sets isCreateModalOpen to true', () => {
      useUsersStore.getState().openCreateModal();
      expect(useUsersStore.getState().isCreateModalOpen).toBe(true);
    });

    it('closeCreateModal sets isCreateModalOpen to false', () => {
      useUsersStore.setState({ isCreateModalOpen: true });
      useUsersStore.getState().closeCreateModal();
      expect(useUsersStore.getState().isCreateModalOpen).toBe(false);
    });
  });

  // ── Edit Modal ────────────────────────────────────────────────────────

  describe('Edit Modal', () => {
    it('should start with the edit modal closed and no userId', () => {
      const state = useUsersStore.getState();
      expect(state.isEditModalOpen).toBe(false);
      expect(state.editUserId).toBeNull();
    });

    it('openEditModal sets isEditModalOpen to true and stores the userId', () => {
      useUsersStore.getState().openEditModal('user-123');
      const state = useUsersStore.getState();
      expect(state.isEditModalOpen).toBe(true);
      expect(state.editUserId).toBe('user-123');
    });

    it('closeEditModal resets isEditModalOpen and editUserId', () => {
      useUsersStore.setState({ isEditModalOpen: true, editUserId: 'user-123' });
      useUsersStore.getState().closeEditModal();
      const state = useUsersStore.getState();
      expect(state.isEditModalOpen).toBe(false);
      expect(state.editUserId).toBeNull();
    });
  });

  // ── Status Action Modal ───────────────────────────────────────────────

  describe('Status Action Modal', () => {
    it('should start closed with all fields null', () => {
      const state = useUsersStore.getState();
      expect(state.isStatusActionModalOpen).toBe(false);
      expect(state.statusActionType).toBeNull();
      expect(state.statusActionUserId).toBeNull();
      expect(state.statusActionUserEmail).toBeNull();
    });

    it('openStatusActionModal sets all status-action fields for activate', () => {
      useUsersStore.getState().openStatusActionModal('activate', 'u-1', 'a@b.com');
      const state = useUsersStore.getState();
      expect(state.isStatusActionModalOpen).toBe(true);
      expect(state.statusActionType).toBe('activate');
      expect(state.statusActionUserId).toBe('u-1');
      expect(state.statusActionUserEmail).toBe('a@b.com');
    });

    it('openStatusActionModal sets all status-action fields for deactivate', () => {
      useUsersStore.getState().openStatusActionModal('deactivate', 'u-2', 'x@y.com');
      const state = useUsersStore.getState();
      expect(state.isStatusActionModalOpen).toBe(true);
      expect(state.statusActionType).toBe('deactivate');
      expect(state.statusActionUserId).toBe('u-2');
      expect(state.statusActionUserEmail).toBe('x@y.com');
    });

    it('closeStatusActionModal resets all status-action fields', () => {
      useUsersStore.setState({
        isStatusActionModalOpen: true,
        statusActionType: 'activate',
        statusActionUserId: 'u-1',
        statusActionUserEmail: 'a@b.com',
      });
      useUsersStore.getState().closeStatusActionModal();
      const state = useUsersStore.getState();
      expect(state.isStatusActionModalOpen).toBe(false);
      expect(state.statusActionType).toBeNull();
      expect(state.statusActionUserId).toBeNull();
      expect(state.statusActionUserEmail).toBeNull();
    });
  });

  // ── Status Success Modal ──────────────────────────────────────────────

  describe('Status Success Modal', () => {
    it('should start closed with null fields', () => {
      const state = useUsersStore.getState();
      expect(state.isStatusSuccessModalOpen).toBe(false);
      expect(state.statusSuccessType).toBeNull();
      expect(state.statusSuccessUserEmail).toBeNull();
    });

    it('openStatusSuccessModal sets type and email for activate', () => {
      useUsersStore.getState().openStatusSuccessModal('activate', 'user@test.com');
      const state = useUsersStore.getState();
      expect(state.isStatusSuccessModalOpen).toBe(true);
      expect(state.statusSuccessType).toBe('activate');
      expect(state.statusSuccessUserEmail).toBe('user@test.com');
    });

    it('openStatusSuccessModal sets type and email for deactivate', () => {
      useUsersStore.getState().openStatusSuccessModal('deactivate', 'other@test.com');
      const state = useUsersStore.getState();
      expect(state.isStatusSuccessModalOpen).toBe(true);
      expect(state.statusSuccessType).toBe('deactivate');
      expect(state.statusSuccessUserEmail).toBe('other@test.com');
    });

    it('closeStatusSuccessModal resets all fields', () => {
      useUsersStore.setState({
        isStatusSuccessModalOpen: true,
        statusSuccessType: 'deactivate',
        statusSuccessUserEmail: 'x@y.com',
      });
      useUsersStore.getState().closeStatusSuccessModal();
      const state = useUsersStore.getState();
      expect(state.isStatusSuccessModalOpen).toBe(false);
      expect(state.statusSuccessType).toBeNull();
      expect(state.statusSuccessUserEmail).toBeNull();
    });
  });

  // ── Reset Password Modal ──────────────────────────────────────────────

  describe('Reset Password Modal', () => {
    it('should start closed with null fields', () => {
      const state = useUsersStore.getState();
      expect(state.isResetPasswordModalOpen).toBe(false);
      expect(state.resetPasswordUserId).toBeNull();
      expect(state.resetPasswordUserEmail).toBeNull();
    });

    it('openResetPasswordModal sets userId and email', () => {
      useUsersStore.getState().openResetPasswordModal('u-42', 'reset@test.com');
      const state = useUsersStore.getState();
      expect(state.isResetPasswordModalOpen).toBe(true);
      expect(state.resetPasswordUserId).toBe('u-42');
      expect(state.resetPasswordUserEmail).toBe('reset@test.com');
    });

    it('closeResetPasswordModal resets all fields', () => {
      useUsersStore.setState({
        isResetPasswordModalOpen: true,
        resetPasswordUserId: 'u-42',
        resetPasswordUserEmail: 'reset@test.com',
      });
      useUsersStore.getState().closeResetPasswordModal();
      const state = useUsersStore.getState();
      expect(state.isResetPasswordModalOpen).toBe(false);
      expect(state.resetPasswordUserId).toBeNull();
      expect(state.resetPasswordUserEmail).toBeNull();
    });
  });

  // ── Reset Password Success Modal ──────────────────────────────────────

  describe('Reset Password Success Modal', () => {
    it('should start closed with null email', () => {
      const state = useUsersStore.getState();
      expect(state.isResetPasswordSuccessModalOpen).toBe(false);
      expect(state.resetPasswordSuccessEmail).toBeNull();
    });

    it('openResetPasswordSuccessModal sets email and opens modal', () => {
      useUsersStore.getState().openResetPasswordSuccessModal('done@test.com');
      const state = useUsersStore.getState();
      expect(state.isResetPasswordSuccessModalOpen).toBe(true);
      expect(state.resetPasswordSuccessEmail).toBe('done@test.com');
    });

    it('closeResetPasswordSuccessModal resets fields', () => {
      useUsersStore.setState({
        isResetPasswordSuccessModalOpen: true,
        resetPasswordSuccessEmail: 'done@test.com',
      });
      useUsersStore.getState().closeResetPasswordSuccessModal();
      const state = useUsersStore.getState();
      expect(state.isResetPasswordSuccessModalOpen).toBe(false);
      expect(state.resetPasswordSuccessEmail).toBeNull();
    });
  });

  // ── Cancel Invitation Modal ───────────────────────────────────────────

  describe('Cancel Invitation Modal', () => {
    it('should start closed with null fields', () => {
      const state = useUsersStore.getState();
      expect(state.isCancelInvitationModalOpen).toBe(false);
      expect(state.cancelInvitationUserId).toBeNull();
      expect(state.cancelInvitationUserEmail).toBeNull();
      expect(state.cancelInvitationUserName).toBeNull();
    });

    it('openCancelInvitationModal sets userId, email, and name', () => {
      useUsersStore.getState().openCancelInvitationModal('u-99', 'inv@test.com', 'John Doe');
      const state = useUsersStore.getState();
      expect(state.isCancelInvitationModalOpen).toBe(true);
      expect(state.cancelInvitationUserId).toBe('u-99');
      expect(state.cancelInvitationUserEmail).toBe('inv@test.com');
      expect(state.cancelInvitationUserName).toBe('John Doe');
    });

    it('closeCancelInvitationModal resets all fields', () => {
      useUsersStore.setState({
        isCancelInvitationModalOpen: true,
        cancelInvitationUserId: 'u-99',
        cancelInvitationUserEmail: 'inv@test.com',
        cancelInvitationUserName: 'John Doe',
      });
      useUsersStore.getState().closeCancelInvitationModal();
      const state = useUsersStore.getState();
      expect(state.isCancelInvitationModalOpen).toBe(false);
      expect(state.cancelInvitationUserId).toBeNull();
      expect(state.cancelInvitationUserEmail).toBeNull();
      expect(state.cancelInvitationUserName).toBeNull();
    });
  });

  // ── Edit Company Modal ────────────────────────────────────────────────

  describe('Edit Company Modal', () => {
    it('should start closed with null fields', () => {
      const state = useUsersStore.getState();
      expect(state.isEditCompanyModalOpen).toBe(false);
      expect(state.editCompanyId).toBeNull();
      expect(state.editCompanyName).toBeNull();
    });

    it('openEditCompanyModal sets companyId and companyName', () => {
      useUsersStore.getState().openEditCompanyModal('c-1', 'Acme Corp');
      const state = useUsersStore.getState();
      expect(state.isEditCompanyModalOpen).toBe(true);
      expect(state.editCompanyId).toBe('c-1');
      expect(state.editCompanyName).toBe('Acme Corp');
    });

    it('closeEditCompanyModal resets all fields', () => {
      useUsersStore.setState({
        isEditCompanyModalOpen: true,
        editCompanyId: 'c-1',
        editCompanyName: 'Acme Corp',
      });
      useUsersStore.getState().closeEditCompanyModal();
      const state = useUsersStore.getState();
      expect(state.isEditCompanyModalOpen).toBe(false);
      expect(state.editCompanyId).toBeNull();
      expect(state.editCompanyName).toBeNull();
    });
  });

  // ── Bulk Action Modal ─────────────────────────────────────────────────

  describe('Bulk Action Modal', () => {
    it('should start closed with null/empty fields', () => {
      const state = useUsersStore.getState();
      expect(state.isBulkActionModalOpen).toBe(false);
      expect(state.bulkActionType).toBeNull();
      expect(state.bulkActionCompanyName).toBeNull();
      expect(state.bulkActionUserIds).toEqual([]);
    });

    it('openBulkActionModal sets type, companyName, and userIds for activate', () => {
      useUsersStore.getState().openBulkActionModal('activate', 'Acme Corp', ['u-1', 'u-2', 'u-3']);
      const state = useUsersStore.getState();
      expect(state.isBulkActionModalOpen).toBe(true);
      expect(state.bulkActionType).toBe('activate');
      expect(state.bulkActionCompanyName).toBe('Acme Corp');
      expect(state.bulkActionUserIds).toEqual(['u-1', 'u-2', 'u-3']);
    });

    it('openBulkActionModal sets type, companyName, and userIds for deactivate', () => {
      useUsersStore.getState().openBulkActionModal('deactivate', 'Beta Inc', ['u-10', 'u-20']);
      const state = useUsersStore.getState();
      expect(state.isBulkActionModalOpen).toBe(true);
      expect(state.bulkActionType).toBe('deactivate');
      expect(state.bulkActionCompanyName).toBe('Beta Inc');
      expect(state.bulkActionUserIds).toEqual(['u-10', 'u-20']);
    });

    it('closeBulkActionModal resets all fields', () => {
      useUsersStore.setState({
        isBulkActionModalOpen: true,
        bulkActionType: 'deactivate',
        bulkActionCompanyName: 'Beta Inc',
        bulkActionUserIds: ['u-10'],
      });
      useUsersStore.getState().closeBulkActionModal();
      const state = useUsersStore.getState();
      expect(state.isBulkActionModalOpen).toBe(false);
      expect(state.bulkActionType).toBeNull();
      expect(state.bulkActionCompanyName).toBeNull();
      expect(state.bulkActionUserIds).toEqual([]);
    });
  });

  // ── Company Expand / Collapse ─────────────────────────────────────────

  describe('Company Expand / Collapse', () => {
    it('should start with no expanded companies', () => {
      expect(useUsersStore.getState().expandedCompanyIds).toEqual([]);
    });

    it('toggleCompany adds a company when it is not expanded', () => {
      useUsersStore.getState().toggleCompany('c-1');
      expect(useUsersStore.getState().expandedCompanyIds).toEqual(['c-1']);
    });

    it('toggleCompany removes a company when it is already expanded', () => {
      useUsersStore.setState({ expandedCompanyIds: ['c-1', 'c-2'] });
      useUsersStore.getState().toggleCompany('c-1');
      expect(useUsersStore.getState().expandedCompanyIds).toEqual(['c-2']);
    });

    it('toggleCompany can expand multiple companies sequentially', () => {
      useUsersStore.getState().toggleCompany('c-1');
      useUsersStore.getState().toggleCompany('c-2');
      useUsersStore.getState().toggleCompany('c-3');
      expect(useUsersStore.getState().expandedCompanyIds).toEqual(['c-1', 'c-2', 'c-3']);
    });

    it('toggleCompany twice on the same id returns to original state', () => {
      useUsersStore.getState().toggleCompany('c-5');
      useUsersStore.getState().toggleCompany('c-5');
      expect(useUsersStore.getState().expandedCompanyIds).toEqual([]);
    });

    it('expandAll sets expandedCompanyIds to the provided list', () => {
      useUsersStore.getState().expandAll(['c-1', 'c-2', 'c-3']);
      expect(useUsersStore.getState().expandedCompanyIds).toEqual(['c-1', 'c-2', 'c-3']);
    });

    it('expandAll replaces any previously expanded companies', () => {
      useUsersStore.setState({ expandedCompanyIds: ['c-old'] });
      useUsersStore.getState().expandAll(['c-new-1', 'c-new-2']);
      expect(useUsersStore.getState().expandedCompanyIds).toEqual(['c-new-1', 'c-new-2']);
    });

    it('collapseAll clears the expandedCompanyIds array', () => {
      useUsersStore.setState({ expandedCompanyIds: ['c-1', 'c-2', 'c-3'] });
      useUsersStore.getState().collapseAll();
      expect(useUsersStore.getState().expandedCompanyIds).toEqual([]);
    });

    it('collapseAll on already-empty list is a no-op', () => {
      useUsersStore.getState().collapseAll();
      expect(useUsersStore.getState().expandedCompanyIds).toEqual([]);
    });
  });

  // ── Cross-slice independence ──────────────────────────────────────────

  describe('Cross-slice independence', () => {
    it('opening one modal does not affect other modal states', () => {
      useUsersStore.getState().openCreateModal();
      useUsersStore.getState().openEditModal('u-1');
      useUsersStore.getState().openStatusActionModal('activate', 'u-2', 'a@b.com');

      const state = useUsersStore.getState();
      expect(state.isCreateModalOpen).toBe(true);
      expect(state.isEditModalOpen).toBe(true);
      expect(state.editUserId).toBe('u-1');
      expect(state.isStatusActionModalOpen).toBe(true);
      expect(state.statusActionType).toBe('activate');

      // Other modals remain closed
      expect(state.isStatusSuccessModalOpen).toBe(false);
      expect(state.isResetPasswordModalOpen).toBe(false);
      expect(state.isResetPasswordSuccessModalOpen).toBe(false);
      expect(state.isCancelInvitationModalOpen).toBe(false);
      expect(state.isEditCompanyModalOpen).toBe(false);
      expect(state.isBulkActionModalOpen).toBe(false);
    });

    it('closing one modal does not affect other open modals', () => {
      useUsersStore.getState().openCreateModal();
      useUsersStore.getState().openEditModal('u-1');
      useUsersStore.getState().closeCreateModal();

      const state = useUsersStore.getState();
      expect(state.isCreateModalOpen).toBe(false);
      expect(state.isEditModalOpen).toBe(true);
      expect(state.editUserId).toBe('u-1');
    });
  });
});
