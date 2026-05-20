import { useProjectsStore } from './projects.store';

describe('useProjectsStore', () => {
  beforeEach(() => {
    useProjectsStore.setState({
      selectedProjectId: null,
      isDeleteDialogOpen: false,
      memberToRemoveId: null,
    });
  });

  it('has correct initial state', () => {
    const state = useProjectsStore.getState();
    expect(state.selectedProjectId).toBeNull();
    expect(state.isDeleteDialogOpen).toBe(false);
    expect(state.memberToRemoveId).toBeNull();
  });

  it('selectProject sets selectedProjectId', () => {
    useProjectsStore.getState().selectProject('proj-1');
    expect(useProjectsStore.getState().selectedProjectId).toBe('proj-1');
  });

  it('clearSelection resets selectedProjectId to null', () => {
    useProjectsStore.getState().selectProject('proj-1');
    useProjectsStore.getState().clearSelection();
    expect(useProjectsStore.getState().selectedProjectId).toBeNull();
  });

  it('openDeleteDialog sets isDeleteDialogOpen to true', () => {
    useProjectsStore.getState().openDeleteDialog();
    expect(useProjectsStore.getState().isDeleteDialogOpen).toBe(true);
  });

  it('closeDeleteDialog sets isDeleteDialogOpen to false', () => {
    useProjectsStore.getState().openDeleteDialog();
    useProjectsStore.getState().closeDeleteDialog();
    expect(useProjectsStore.getState().isDeleteDialogOpen).toBe(false);
  });

  it('setMemberToRemove sets memberToRemoveId', () => {
    useProjectsStore.getState().setMemberToRemove('user-42');
    expect(useProjectsStore.getState().memberToRemoveId).toBe('user-42');
  });

  it('clearMemberToRemove resets memberToRemoveId to null', () => {
    useProjectsStore.getState().setMemberToRemove('user-42');
    useProjectsStore.getState().clearMemberToRemove();
    expect(useProjectsStore.getState().memberToRemoveId).toBeNull();
  });

  it('selectProject can be called multiple times', () => {
    useProjectsStore.getState().selectProject('proj-1');
    useProjectsStore.getState().selectProject('proj-2');
    expect(useProjectsStore.getState().selectedProjectId).toBe('proj-2');
  });
});
