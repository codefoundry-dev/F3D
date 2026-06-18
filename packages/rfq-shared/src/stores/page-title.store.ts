import { create } from 'zustand';

interface PageTitleState {
  title: string | null;
  subtitle: string | null;
  /** Optional route the header back-arrow navigates to. When null, no arrow. */
  backTo: string | null;
  setTitle: (title: string | null, subtitle?: string | null, backTo?: string | null) => void;
}

export const usePageTitleStore = create<PageTitleState>((set) => ({
  title: null,
  subtitle: null,
  backTo: null,
  setTitle: (title, subtitle, backTo) =>
    set({ title, subtitle: subtitle ?? null, backTo: backTo ?? null }),
}));
