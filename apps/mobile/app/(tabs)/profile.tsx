import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BodyText, Button, Card, Screen, StateView, Title } from '../../components/ui';
import { useAuth } from '../../store/auth';
import { usePreferences } from '../../store/preferences';
import { useTheme } from '../../hooks/useTheme';
import { authError } from '../../features/auth/forms';

export default function ProfileScreen() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const { colors } = useTheme();
  const user = useAuth((state) => state.user);
  const hasSession = useAuth((state) => state.hasSession);
  const storedIssue = useAuth((state) => state.issue);
  const { locale, setLocale, mode, setMode } = usePreferences();
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  async function reload() {
    setBusy(true); setIssue(null);
    try { await useAuth.getState().reloadProfile(); }
    catch (error) { setIssue(authError(error, t)); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setIssue(null);
    try { await useAuth.getState().logout(); }
    catch (error) { setIssue(authError(error, t)); }
    finally { setBusy(false); }
  }
  return (
    <Screen><Title>{t('profile')}</Title>
      {hasSession ? user ? (
        <Card><Title>{[user.firstName, user.lastName].filter(Boolean).join(' ')}</Title>
          {user.phone ? <BodyText>{user.phone}</BodyText> : null}
          {!user.email.endsWith('@phone.local') ? <BodyText>{user.email}</BodyText> : null}
          {user.address ? <BodyText>{user.address}</BodyText> : null}
          <Button title={t('editProfile')} onPress={() => router.push('/profile/edit')} />
          <Button title={t('orders')} variant="secondary" onPress={() => router.push('/orders')} />
          <Button title={t('favorites')} variant="secondary" onPress={() => router.push('/(tabs)/favorites')} />
        </Card>
      ) : <Card><StateView kind="error" title={t('profileUnavailable')} message={t('profileUnavailableBody')} />
        <Button title={t('retry')} onPress={reload} loading={busy} /></Card> : (
        <Card><Title>{t('guestTitle')}</Title><BodyText>{t('guestBody')}</BodyText>
          <Button title={t('login')} onPress={() => router.push('/auth/login')} />
          <Button title={t('register')} variant="secondary" onPress={() => router.push('/auth/register')} />
        </Card>
      )}
      {issue ? <BodyText accessibilityRole="alert" style={{ color: colors.danger }}>{issue}</BodyText> : null}
      {!issue && storedIssue === 'STORAGE' ? <BodyText accessibilityRole="alert">{t('storageError')}</BodyText> : null}
      <Card><Title>{t('preferences')}</Title><BodyText>{t('language')}</BodyText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Button title="O‘zbekcha" variant={locale === 'uz' ? 'primary' : 'secondary'} onPress={() => setLocale('uz')} /></View>
          <View style={{ flex: 1 }}><Button title="Русский" variant={locale === 'ru' ? 'primary' : 'secondary'} onPress={() => setLocale('ru')} /></View>
        </View><BodyText>{t('theme')}</BodyText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['light', 'dark', 'system'] as const).map((choice) => <View key={choice} style={{ flex: 1 }}>
            <Button title={t(choice)} variant={mode === choice ? 'primary' : 'secondary'} onPress={() => setMode(choice)} />
          </View>)}
        </View>
      </Card>
      {hasSession ? <Card><Title>{t('accountDeletion')}</Title><BodyText>{t('accountDeletionBody')}</BodyText>
        <Button title={t('contactSupport')} variant="secondary" onPress={() => router.push('/support')} />
      </Card> : null}
      <Button title={t('support')} variant="secondary" onPress={() => router.push('/support')} />
      {hasSession || storedIssue === 'STORAGE' ? <Button title={hasSession ? t('logout') : t('retryLogout')}
        variant="danger" onPress={logout} loading={busy} /> : null}
    </Screen>
  );
}
