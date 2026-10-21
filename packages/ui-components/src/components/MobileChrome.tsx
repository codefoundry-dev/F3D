import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { cn } from '../utils/cn';

/**
 * Phone app-shell chrome shared between the shell (`AppLayout`) and pages
 * (ADR-0019, FOR-373/374). Pages don't know where the top bar or the bottom nav
 * live, so the shell registers two mount points here and pages portal into them:
 *
 * - **header slot**: the ⋯ menu of secondary actions, in the phone top bar.
 * - **action bar slot**: the fixed footer bar holding the screen's main action.
 *
 * Wizards also hide the bottom nav while they're open (`useHideMobileNav`).
 *
 * A tiny external store instead of context so pages and the shell stay
 * decoupled (the shell can render the slots anywhere) and so ui-components needs
 * no state library.
 */
interface MobileChromeState {
  headerSlot: HTMLElement | null;
  barSlot: HTMLElement | null;
  /** Number of mounted callers asking for the bottom nav to be hidden. */
  navHiders: number;
  /** Replaces the top-bar back arrow's navigation (wizard exit confirm). */
  exitHandler: (() => void) | null;
}

let state: MobileChromeState = { headerSlot: null, barSlot: null, navHiders: 0, exitHandler: null };
const listeners = new Set<() => void>();

function setState(patch: Partial<MobileChromeState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function useChrome<T>(select: (s: MobileChromeState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state));
}

export function useMobileHeaderSlot(): HTMLElement | null {
  return useChrome((s) => s.headerSlot);
}

export function useMobileActionBarSlot(): HTMLElement | null {
  return useChrome((s) => s.barSlot);
}

/** True while any mounted page has asked for the phone bottom nav to be hidden. */
export function useMobileNavHidden(): boolean {
  return useChrome((s) => s.navHiders > 0);
}

/**
 * Hide the phone bottom nav while the calling component is mounted (wizards,
 * B8). Reference-counted so nested callers don't fight.
 */
export function useHideMobileNav(active = true): void {
  useEffect(() => {
    if (!active) return;
    setState({ navHiders: state.navHiders + 1 });
    return () => setState({ navHiders: Math.max(0, state.navHiders - 1) });
  }, [active]);
}

/**
 * While mounted, the phone top-bar back arrow calls `onExit` instead of
 * navigating (B8: leaving a wizard goes through its unsaved-changes confirm).
 * The latest handler wins; pass `null` to opt out.
 */
export function useMobileExitHandler(onExit: (() => void) | null): void {
  const ref = useRef(onExit);
  ref.current = onExit;
  const enabled = onExit !== null;
  useEffect(() => {
    if (!enabled) return;
    const handler = () => ref.current?.();
    setState({ exitHandler: handler });
    return () => {
      if (state.exitHandler === handler) setState({ exitHandler: null });
    };
  }, [enabled]);
}

/** Shell side: the exit handler a page registered, if any. */
export function useMobileExit(): (() => void) | null {
  return useChrome((s) => s.exitHandler);
}

/** Shell-side mount point for the ⋯ secondary-actions menu in the phone top bar. */
export function MobileHeaderActionsSlot({ className }: { className?: string }) {
  const ref = useCallback((el: HTMLDivElement | null) => {
    if (el) setState({ headerSlot: el });
    else setState({ headerSlot: null });
  }, []);
  return <div ref={ref} data-testid="mobile-header-slot" className={cn('contents', className)} />;
}

/**
 * Shell-side mount point for the fixed action bar. Render it at the END of the
 * scrolling content: the bar brings an in-flow spacer so the last content isn't
 * hidden behind it.
 */
export function MobileActionBarSlot({ className }: { className?: string }) {
  const ref = useCallback((el: HTMLDivElement | null) => {
    if (el) setState({ barSlot: el });
    else setState({ barSlot: null });
  }, []);
  return <div ref={ref} data-testid="mobile-action-bar-slot" className={className} />;
}

/** Test helper: reset the store between tests. */
export function __resetMobileChrome() {
  setState({ headerSlot: null, barSlot: null, navHiders: 0, exitHandler: null });
}
