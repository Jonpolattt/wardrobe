import type { ReactNode } from 'react';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../store/auth';
import { safeContinuationPath } from '../features/links/deep-links';
import { Button, Screen, StateView } from './ui';

export function RequireAuth({ children, returnTo }: { children: ReactNode; returnTo?: string }) {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const pathname = usePathname();
  const { items } = useLocalSearchParams<{ items?: string | string[] }>();
  // Preserve only the existing checkout row selection, never arbitrary
  // route query fields or credentials. Invalid repeated selections fall back.
  const continuation = returnTo ?? (pathname === '/checkout' && items !== undefined
    ? typeof items === 'string' ? `/checkout?items=${encodeURIComponent(items)}` : '/profile'
    : pathname);
  const hydrated = useAuth((state) => state.hydrated);
  const hasSession = useAuth((state) => state.hasSession);
  if (!hydrated) return <Screen><StateView kind="loading" title={t('loadingSession')} /></Screen>;
  if (!hasSession) return (
    <Screen>
      <StateView kind="empty" title={t('signInRequired')} message={t('signInRequiredBody')} />
      <Button title={t('login')} onPress={() => router.push({
        pathname: '/auth/login', params: { returnTo: safeContinuationPath(continuation) },
      })} />
    </Screen>
  );
  return <>{children}</>;
}
