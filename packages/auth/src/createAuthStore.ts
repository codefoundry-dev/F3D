import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string | null;
}

export interface AuthState {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  setAuth: (user: AuthUser) => void;
  clearAuth: () => void;
  setAuthLoading: (loading: boolean) => void;
}

/**
 * Factory that creates a Zustand auth store with app-specific persistence key.
 *
 * @param persistName - Unique localStorage key per app (e.g. 'forethread-company-auth')
 */
export function createAuthStore(persistName: string) {
  return create<AuthState>()(
    persist(
      (set) => ({
        currentUser: null,
        isAuthenticated: false,
        isAuthLoading: true,

        setAuth: (user) => {
          set({ currentUser: user, isAuthenticated: true, isAuthLoading: false });
        },

        clearAuth: () => {
          set({ currentUser: null, isAuthenticated: false, isAuthLoading: false });
        },

        setAuthLoading: (loading) => {
          set({ isAuthLoading: loading });
        },
      }),
      {
        name: persistName,
        // Only persist user info
        partialize: (state) => ({ currentUser: state.currentUser }),
        onRehydrateStorage: () => (state) => {
          // After rehydration, isAuthenticated is false until the session is verified
          if (state) {
            state.isAuthenticated = false;
          }
        },
      },
    ),
  );
}
