import { create } from 'zustand';
import type { AuthSession, UserProfile } from '@wardrobe/types';
import { ApiClientError } from '@wardrobe/api-client';
import { mobileApi } from '../services/api';
import { queryClient } from '../services/query-client';
import { replaceSession, subscribeSessionChanges, tokenStorage } from '../services/secure-session';

interface PendingRegistration { phone: string; sentAt: number; verifiedAt?: number; }
interface PendingRecovery { identifier: string; method: 'PHONE' | 'EMAIL'; sentAt: number; }
interface AuthState {
  user: UserProfile | null;
  hasSession: boolean;
  hydrated: boolean;
  sessionKey: string;
  issue: string | null;
  pendingRegistration: PendingRegistration | null;
  pendingRecovery: PendingRecovery | null;
  hydrate(): Promise<void>;
  setSession(payload: AuthSession & { user: UserProfile }, expectedSessionKey?: string): Promise<void>;
  logout(): Promise<void>;
  reloadProfile(): Promise<void>;
  beginRegistration(phone: string): void;
  markRegistrationVerified(): void;
  beginRecovery(identifier: string, method: 'PHONE' | 'EMAIL'): void;
  clearPending(): void;
}
let hydration: Promise<void> | null = null;
function clearPrivateCache() {
  void queryClient.cancelQueries().catch(() => undefined);
  queryClient.clear();
}
function errorCode(error: unknown): string {
  return error instanceof ApiClientError ? error.code : 'NETWORK';
}
export const useAuth = create<AuthState>((set, get) => ({
  user: null, hasSession: false, hydrated: false, sessionKey: 'guest',
  issue: null, pendingRegistration: null, pendingRecovery: null,
  async hydrate() {
    if (get().hydrated) return;
    if (hydration) return hydration;
    hydration = (async () => {
      try {
        const key = await tokenStorage.getSessionKey!();
        const tokens = await tokenStorage.getTokens();
        if (get().sessionKey !== key) return;
        // Open the app as soon as secure storage is known. Network failure
        // preserves a stored session and never blocks offline navigation.
        set({ hasSession: !!tokens, hydrated: true, sessionKey: key, issue: null });
        if (tokens) {
          try {
            const user = await mobileApi.me();
            if (get().sessionKey === key && get().hasSession) set({ user, issue: null });
          } catch (error) {
            if (get().sessionKey === key) set({ issue: errorCode(error) });
          }
        }
      } catch (error) { set({ hydrated: true, issue: errorCode(error) }); }
      finally { set({ hydrated: true }); }
    })().finally(() => { hydration = null; });
    return hydration;
  },
  async setSession(payload, expectedSessionKey) {
    const key = await replaceSession({ accessToken: payload.accessToken, refreshToken: payload.refreshToken }, expectedSessionKey);
    if (await tokenStorage.getSessionKey!() !== key || get().sessionKey !== key || !get().hasSession) {
      throw new ApiClientError('SESSION_CHANGED');
    }
    set({ user: payload.user, hasSession: true, hydrated: true, sessionKey: key,
      issue: null, pendingRegistration: null, pendingRecovery: null });
  },
  async logout() {
    const clearing = tokenStorage.clearTokens();
    clearPrivateCache();
    try { await clearing; set({ issue: null }); }
    catch (error) { set({ issue: errorCode(error) }); throw error; }
  },
  async reloadProfile() {
    const key = await tokenStorage.getSessionKey!();
    const tokens = await tokenStorage.getTokens();
    if (get().sessionKey !== key) throw new ApiClientError('SESSION_CHANGED');
    if (!tokens) { set({ hasSession: false, user: null, hydrated: true, sessionKey: key }); return; }
    set({ hasSession: true, sessionKey: key, issue: null });
    try {
      const user = await mobileApi.me();
      if (get().sessionKey === key && get().hasSession) set({ user, issue: null });
    } catch (error) {
      if (get().sessionKey === key) set({ issue: errorCode(error) });
      throw error;
    }
  },
  beginRegistration(phone) { set({ pendingRegistration: { phone, sentAt: Date.now() }, issue: null }); },
  markRegistrationVerified() {
    const pending = get().pendingRegistration;
    if (pending) set({ pendingRegistration: { ...pending, verifiedAt: Date.now() } });
  },
  beginRecovery(identifier, method) { set({ pendingRecovery: { identifier, method, sentAt: Date.now() } }); },
  clearPending() { set({ pendingRegistration: null, pendingRecovery: null }); },
}));
subscribeSessionChanges((event) => {
  const previous = useAuth.getState();
  if (event.kind === 'cleared' || event.kind === 'replaced') {
    clearPrivateCache();
    useAuth.setState({ user: null, issue: null, pendingRegistration: null, pendingRecovery: null,
      hasSession: event.hasSession, sessionKey: event.sessionKey, hydrated: true });
  } else {
    useAuth.setState({ hasSession: event.hasSession, sessionKey: event.sessionKey,
      user: event.hasSession ? previous.user : null });
  }
});
