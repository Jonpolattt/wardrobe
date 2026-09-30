'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  avatar?: string;
  role: 'ADMIN' | 'USER';
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  // zustand's persist middleware reads localStorage and merges it into the
  // store asynchronously — on the very first render after a hard refresh,
  // `user` is still `null` (the default) even if a valid session exists in
  // localStorage. Any code that redirects to /login when `user === null`
  // (e.g. AdminGuard) must wait for `hasHydrated` first, or it will kick a
  // still-logged-in admin out on every page refresh.
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  setSession: (data: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setSession: ({ accessToken, refreshToken, user }) => set({ accessToken, refreshToken, user }),
      clearSession: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: 'fashion-marketplace-auth',
      // hasHydrated itself must NOT be persisted — it always starts false on
      // a fresh load and is only ever flipped true at runtime below.
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
