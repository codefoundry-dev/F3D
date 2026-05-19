import { create } from 'zustand';

interface ProjectsState {
  selectedProjectId: string | null;
  isDeleteDialogOpen: boolean;
  memberToRemoveId: string | null;
  selectProject: (id: string) => void;
  clearSelection: () => void;
  openDeleteDialog: () => void;
  closeDeleteDialog: () => void;
  setMemberToRemove: (id: string) => void;
  clearMemberToRemove: () => void;
}

export const useProjectsStore = create<ProjectsState>()((set) => ({
  selectedProjectId: null,
  isDeleteDialogOpen: false,
  memberToRemoveId: null,

  selectProject: (id) => set({ selectedProjectId: id }),
  clearSelection: () => set({ selectedProjectId: null }),
  openDeleteDialog: () => set({ isDeleteDialogOpen: true }),
  closeDeleteDialog: () => set({ isDeleteDialogOpen: false }),
  setMemberToRemove: (id) => set({ memberToRemoveId: id }),
  clearMemberToRemove: () => set({ memberToRemoveId: null }),
}));
