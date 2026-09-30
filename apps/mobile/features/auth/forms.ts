import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, type Href } from 'expo-router';
import { useAuth } from '../../store/auth';
import { safeSignedInDestination } from '../links/deep-links';
import { ApiClientError } from '@wardrobe/api-client';
import { isUzPhone, normalizeUzPhone } from '@wardrobe/validation';

/** Ignore a public auth response after leaving its screen or replacing its account. */
export function useAuthRequestGuard() {
  const focus = useRef({ active: false, epoch: 0 });
  useFocusEffect(useCallback(() => {
    focus.current = { active: true, epoch: focus.current.epoch + 1 };
    return () => { focus.current = { active: false, epoch: focus.current.epoch + 1 }; };
  }, []));
  return () => {
    const epoch = focus.current.epoch;
    const sessionKey = useAuth.getState().sessionKey;
    const isFocused = () => focus.current.active && focus.current.epoch === epoch;
    return { sessionKey, isFocused, isCurrent: () => isFocused() && useAuth.getState().sessionKey === sessionKey };
  };
}

export function authError(error: unknown, t: (key: string) => string, fallback = 'requestFailed'): string {
  if (!(error instanceof ApiClientError)) return t(fallback);
  if (error.code === 'NETWORK' || error.code === 'TIMEOUT' || error.code === 'HTTP') return t('connectionError');
  if (error.code === 'STORAGE') return t('storageError');
  if (error.code === 'SESSION_CHANGED') return t('sessionChanged');
  if (error.code === 'ABORTED') return t('cancelled');
  if (error.code === 'GRAPHQL') return t(fallback);
  return t('requestFailed');
}
export function requireAuthSuccess(value: boolean): void {
  if (value !== true) throw new ApiClientError('GRAPHQL');
}
export function normalizeIdentifier(value: string): string {
  return isUzPhone(value) ? normalizeUzPhone(value) : value.trim().toLowerCase();
}
export function useRemainingSeconds(sentAt: number | undefined, seconds: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [sentAt]);
  return sentAt ? Math.max(0, Math.ceil((sentAt + seconds * 1000 - now) / 1000)) : 0;
}
export function signedInDestination(value: string | string[] | undefined): Href {
  return safeSignedInDestination(value) as Href;
}