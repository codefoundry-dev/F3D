import { create } from 'zustand';

interface PageTitleState {
  title: string | null;
  subtitle: string | null;
  setTitle: (title: string | null, subtitle?: string | null) => void;
}

export const usePageTitleStore = create<PageTitleState>((set) => ({
  title: null,
  subtitle: null,
  setTitle: (title, subtitle) => set({ title, subtitle: subtitle ?? null }),
}));
