import { create } from 'zustand';

/**
 * A single breadcrumb crumb. Serializable (no ReactNode) so it can live in the
 * store; `AppLayout` maps these to the DS `Breadcrumbs` items (adding the Home
 * root + an icon chip) and wires `to` to router navigation.
 */
export interface PageBreadcrumb {
  label: string;
  /** Route to navigate to when clicked. Omit for the current (last) crumb. */
  to?: string;
}

interface PageTitleState {
  title: string | null;
  subtitle: string | null;
  /** Optional route the header back-arrow navigates to. When null, no arrow. */
  backTo: string | null;
  /**
   * Optional explicit breadcrumb trail for the app-bar. When null, the shell
   * falls back to a `Home › {title}` trail derived from `title`.
   */
  breadcrumbs: PageBreadcrumb[] | null;
  setTitle: (
    title: string | null,
    subtitle?: string | null,
    backTo?: string | null,
    breadcrumbs?: PageBreadcrumb[] | null,
  ) => void;
}

export const usePageTitleStore = create<PageTitleState>((set) => ({
  title: null,
  subtitle: null,
  backTo: null,
  breadcrumbs: null,
  setTitle: (title, subtitle, backTo, breadcrumbs) =>
    set({
      title,
      subtitle: subtitle ?? null,
      backTo: backTo ?? null,
      breadcrumbs: breadcrumbs ?? null,
    }),
}));
