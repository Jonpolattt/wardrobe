import { useState, type ComponentProps } from 'react';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SITE_ORIGIN } from '@wardrobe/config';
import { spacing, radius, typography } from '@wardrobe/theme';
import { BodyText, Button, Card, Screen, StateView, Title } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useAuth } from '../../store/auth';
import { usePreferences } from '../../store/preferences';
import { useTheme } from '../../hooks/useTheme';
import { authError } from '../../features/auth/forms';

export default function ProfileScreen() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const { colors } = useTheme();
  const user = useAuth(state => state.user);
  const hasSession = useAuth(state => state.hasSession);
  const storedIssue = useAuth(state => state.issue);
  const { locale, setLocale, mode, setMode } = usePreferences();
  const [section, setSection] = useState<'language' | 'theme' | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
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
    try { await useAuth.getState().logout(); setConfirmLogout(false); }
    catch (error) { setIssue(authError(error, t)); }
    finally { setBusy(false); }
  }
  function Row({ icon, title, onPress, divider = false, danger = false, selected = false, choice = false }: {
    icon: ComponentProps<typeof Icon>['name']; title: string; onPress: () => void;
    divider?: boolean; danger?: boolean; selected?: boolean; choice?: boolean;
  }) {
    const color = danger ? colors.danger : selected ? colors.accentText : colors.mutedText;
    return <Pressable accessibilityRole={choice ? 'radio' : 'button'} accessibilityState={choice ? { checked: selected } : undefined}
      onPress={onPress} disabled={busy} style={({ pressed }) => [styles.row,
        { borderTopColor: colors.border, borderTopWidth: divider ? 1 : 0, opacity: pressed || busy ? 0.65 : 1 }]}>
      <Icon name={icon} size={20} color={color} />
      <BodyText style={[styles.rowLabel, { color }]}>{title}</BodyText>
      {choice ? selected && <Icon name="check" size={18} color={colors.accentText} /> :
        <Icon name="chevronRight" size={17} color={danger ? colors.danger : colors.mutedText} />}
    </Pressable>;
  }
  if (section) return <Screen chrome={false}>
    <View style={styles.sectionHeader}>
      <Pressable onPress={() => setSection(null)} accessibilityRole="button" accessibilityLabel={t('back')}
        style={[styles.back, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Icon name="arrowLeft" size={20} color={colors.text} />
      </Pressable>
      <Title style={styles.sectionTitle}>{t(section)}</Title><View style={styles.backSpacer} />
    </View>
    <Card style={styles.group}>
      {section === 'language' ? (['uz', 'ru'] as const).map((choice, index) =>
        <Row key={choice} icon="globe" title={choice === 'uz' ? 'O‘zbekcha' : 'Русский'} choice selected={locale === choice}
          divider={index > 0} onPress={() => setLocale(choice)} />) :
        (['light', 'dark', 'system'] as const).map((choice, index) =>
          <Row key={choice} icon={choice === 'light' ? 'sun' : 'moon'} title={t(choice)} choice selected={mode === choice}
            divider={index > 0} onPress={() => setMode(choice)} />)}
    </Card>
  </Screen>;
  return <Screen chrome={false}>
    <Title style={styles.pageTitle}>{t('profile')}</Title>
    {hasSession ? user ? <Card style={styles.group}>
      <View style={styles.userHeading}><BodyText style={styles.userName}>{[user.firstName, user.lastName].filter(Boolean).join(' ')}</BodyText>
        {!!user.phone && <BodyText style={[styles.phone, { color: colors.mutedText }]}>{user.phone}</BodyText>}
      </View>
      <Row icon="package" title={t('profileOrders')} divider onPress={() => router.push('/orders')} />
      <Row icon="profile" title={t('profileInfo')} divider onPress={() => router.push('/profile/edit')} />
      <Row icon="heart" title={t('favorites')} divider onPress={() => router.push('/(tabs)/favorites')} />
    </Card> : <Card><StateView kind="error" title={t('profileUnavailable')} message={t('profileUnavailableBody')} />
      <Button title={t('retry')} onPress={reload} loading={busy} /></Card> : <Card>
      <Title>{t('guestTitle')}</Title><BodyText>{t('guestBody')}</BodyText>
      <Button title={t('login')} onPress={() => router.push('/auth/login')} />
      <Button title={t('register')} variant="secondary" onPress={() => router.push('/auth/register')} />
    </Card>}
    {issue ? <BodyText accessibilityRole="alert" style={{ color: colors.danger }}>{issue}</BodyText> : null}
    {!issue && storedIssue === 'STORAGE' ? <BodyText accessibilityRole="alert" style={{ color: colors.danger }}>{t('storageError')}</BodyText> : null}
    <Card style={styles.group}>
      <Row icon="globe" title={t('language')} onPress={() => setSection('language')} />
      <Row icon="moon" title={t('theme')} divider onPress={() => setSection('theme')} />
    </Card>
    {hasSession || storedIssue === 'STORAGE' ? <Card style={styles.group}>
      {user?.role === 'ADMIN' && <Row icon="shield" title={t('adminPanel')} onPress={() => {
        setIssue(null); void Linking.openURL(SITE_ORIGIN + '/' + locale + '/admin').catch(() => setIssue(t('openLinkError')));
      }} />}
      <Row icon="logout" title={hasSession ? t('logoutAccount') : t('retryLogout')} danger divider={user?.role === 'ADMIN'}
        onPress={() => setConfirmLogout(true)} />
    </Card> : <Card style={styles.group}><Row icon="globe" title={t('support')} onPress={() => router.push('/support')} /></Card>}
    <Modal visible={confirmLogout} transparent animationType="fade" onRequestClose={() => !busy && setConfirmLogout(false)}>
      <Pressable style={styles.backdrop} onPress={() => !busy && setConfirmLogout(false)}>
        <Pressable accessibilityViewIsModal onPress={() => undefined} style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <BodyText style={styles.dialogTitle}>{t('logoutConfirmTitle')}</BodyText>
          <BodyText style={{ color: colors.mutedText }}>{t('logoutConfirmBody')}</BodyText>
          {!!issue && <BodyText accessibilityRole="alert" style={{ color: colors.danger }}>{issue}</BodyText>}
          <View style={styles.dialogButtons}><Button title={t('cancel')} variant="secondary" disabled={busy}
            onPress={() => setConfirmLogout(false)} style={{ flex: 1 }} /><Button title={t('confirmLogout')} variant="danger"
            onPress={logout} loading={busy} style={{ flex: 1 }} /></View>
        </Pressable>
      </Pressable>
    </Modal>
  </Screen>;
}
const styles = StyleSheet.create({
  pageTitle: { fontSize: 24, lineHeight: 32, marginBottom: spacing.sm },
  group: { padding: 0, gap: 0, overflow: 'hidden' },
  userHeading: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, gap: spacing.xs },
  userName: { fontFamily: typography.bold, fontSize: 16, lineHeight: 24 },
  phone: { fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56,
    paddingHorizontal: spacing.lg, paddingVertical: 14 },
  rowLabel: { flex: 1, fontFamily: typography.semibold, fontSize: 14, lineHeight: 22 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: { width: 48, height: 48, borderWidth: 1, borderRadius: radius.headerControl, alignItems: 'center', justifyContent: 'center' },
  backSpacer: { width: 48 }, sectionTitle: { flex: 1, textAlign: 'center', fontSize: 20, lineHeight: 28 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', padding: spacing.lg },
  dialog: { alignSelf: 'center', width: '100%', maxWidth: 384, padding: spacing.xxl, borderWidth: 1, borderRadius: radius.card, gap: spacing.sm },
  dialogTitle: { fontFamily: typography.bold, fontSize: 16 }, dialogButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
