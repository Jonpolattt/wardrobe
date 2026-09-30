import * as SecureStore from 'expo-secure-store';
import { ApiClientError, type TokenPair, type TokenStorage } from '@wardrobe/api-client';

const STORAGE_KEY = 'wardrobe.secure-session.v1';
const STORAGE_OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
interface StoredSession extends TokenPair { sessionKey: string; }
export interface SessionChange {
  kind: 'restored' | 'replaced' | 'refreshed' | 'cleared';
  sessionKey: string;
  hasSession: boolean;
}
const listeners = new Set<(event: SessionChange) => void>();
let serial: Promise<void> = Promise.resolve();
let loading: Promise<TokenPair | null> | null = null;
let memory: StoredSession | null | undefined;
let generation = 0;
let replacing = false;
let sessionKey = nextKey('guest');

function nextKey(prefix: string): string { return `${prefix}-${Date.now()}-${++generation}`; }
function validTokens(value: unknown): value is TokenPair {
  const candidate = value as Partial<TokenPair> | null;
  return !!candidate && typeof candidate.accessToken === 'string' && candidate.accessToken.length > 0
    && typeof candidate.refreshToken === 'string' && candidate.refreshToken.length > 0;
}
function snapshot(): TokenPair | null {
  return memory && !replacing ? { accessToken: memory.accessToken, refreshToken: memory.refreshToken } : null;
}
function notify(kind: SessionChange['kind']) {
  const event = { kind, sessionKey, hasSession: !!memory && !replacing };
  for (const listener of listeners) { try { listener(event); } catch { /* No secret-bearing diagnostics. */ } }
}
function queued<T>(operation: () => Promise<T>): Promise<T> {
  const pending = serial.then(operation);
  serial = pending.then(() => undefined, () => undefined);
  return pending;
}
function storageFailure(error: unknown): never {
  if (error instanceof ApiClientError) throw error;
  throw new ApiClientError('STORAGE');
}
async function getTokens(): Promise<TokenPair | null> {
  if (memory !== undefined) return snapshot();
  if (!loading) {
    const readingKey = sessionKey;
    loading = queued(async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (sessionKey !== readingKey) return snapshot();
        let decoded: unknown = null;
        if (raw) { try { decoded = JSON.parse(raw); } catch { decoded = null; } }
        if (validTokens(decoded)) {
          const savedKey = (decoded as Partial<StoredSession>).sessionKey;
          sessionKey = typeof savedKey === 'string' && /^session-\d+-\d+$/.test(savedKey)
            ? savedKey : nextKey('session');
          generation = Math.max(generation, Number(sessionKey.split('-')[2]) || 0);
          memory = { accessToken: decoded.accessToken, refreshToken: decoded.refreshToken, sessionKey };
        } else { memory = null; }
        notify('restored');
        return snapshot();
      } catch (error) { return storageFailure(error); }
    }).finally(() => { loading = null; });
  }
  return loading;
}
async function getSessionKey(): Promise<string> { await getTokens(); return sessionKey; }
async function setTokens(tokens: TokenPair, expectedSessionKey?: string): Promise<void> {
  if (!validTokens(tokens)) throw new ApiClientError('STORAGE');
  await getTokens();
  const writingKey = expectedSessionKey ?? sessionKey;
  return queued(async () => {
    if (!memory || replacing || sessionKey !== writingKey) throw new ApiClientError('SESSION_CHANGED');
    const record = { ...tokens, sessionKey: writingKey };
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(record), STORAGE_OPTIONS);
      if (!memory || replacing || sessionKey !== writingKey) throw new ApiClientError('SESSION_CHANGED');
      memory = record;
      notify('refreshed');
    } catch (error) { storageFailure(error); }
  });
}
async function clearTokens(expectedSessionKey?: string): Promise<void> {
  if (expectedSessionKey !== undefined) {
    return queued(async () => {
      if (sessionKey !== expectedSessionKey) throw new ApiClientError('SESSION_CHANGED');
      memory = null;
      replacing = false;
      sessionKey = nextKey('guest');
      notify('cleared');
      try { await SecureStore.deleteItemAsync(STORAGE_KEY); } catch (error) { storageFailure(error); }
    });
  }
  // Immediate invalidation prevents pending requests from using a logged-out
  // account; serialized deletion cannot race with a later explicit login.
  memory = null;
  replacing = false;
  sessionKey = nextKey('guest');
  const clearingKey = sessionKey;
  notify('cleared');
  return queued(async () => {
    if (sessionKey !== clearingKey) return;
    try { await SecureStore.deleteItemAsync(STORAGE_KEY); } catch (error) { storageFailure(error); }
  });
}
export const tokenStorage: TokenStorage = { getTokens, setTokens, clearTokens, getSessionKey };

/** Explicit successful login; refresh writes use guarded tokenStorage.setTokens. */
export async function replaceSession(tokens: TokenPair, expectedSessionKey?: string): Promise<string> {
  if (!validTokens(tokens)) throw new ApiClientError('STORAGE');
  if (expectedSessionKey !== undefined && sessionKey !== expectedSessionKey) throw new ApiClientError('SESSION_CHANGED');
  sessionKey = nextKey('session');
  const writingKey = sessionKey;
  memory = { ...tokens, sessionKey: writingKey };
  replacing = true;
  notify('replaced');
  return queued(async () => {
    if (sessionKey !== writingKey || !memory) throw new ApiClientError('SESSION_CHANGED');
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(memory), STORAGE_OPTIONS);
      if (sessionKey !== writingKey) throw new ApiClientError('SESSION_CHANGED');
      replacing = false;
      notify('replaced');
      return writingKey;
    } catch (error) {
      if (sessionKey === writingKey) {
        memory = null;
        replacing = false;
        sessionKey = nextKey('guest');
        notify('cleared');
      }
      storageFailure(error);
    }
  });
}
export const saveSessionTokens = replaceSession;
export function subscribeSessionChanges(listener: (event: SessionChange) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
