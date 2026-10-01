import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { spacing, radius, typography } from '@wardrobe/theme';
import { Icon } from '../../components/Icon';
import { useTheme } from '../../hooks/useTheme';
import { isAddress, isName } from '@wardrobe/validation';
import { RequireAuth } from '../../components/RequireAuth';
import { BodyText, Button, Card, Field, Screen, StateView, Title } from '../../components/ui';
import { mobileApi } from '../../services/api';
import { useAuth } from '../../store/auth';
import { authError } from '../../features/auth/forms';

interface EditForm { firstName: string; lastName: string; address: string; }
function EditProfileContent() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const user = useAuth((state) => state.user);
  const sessionKey = useAuth((state) => state.sessionKey);
  const [issue, setIssue] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reloading, setReloading] = useState(false);
  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<EditForm>({
    defaultValues: { firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', address: user?.address ?? '' },
  });
  useEffect(() => {
    reset({ firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', address: user?.address ?? '' });
  }, [user?.id, user?.firstName, user?.lastName, user?.address, reset]);
  const submit = handleSubmit(async (values) => {
    setIssue(null); setSaved(false);
    const writingSession = sessionKey;
    try {
      const updated = await mobileApi.updateProfile({ firstName: values.firstName.trim(),
        lastName: values.lastName.trim(), address: values.address.trim() });
      if (useAuth.getState().sessionKey === writingSession) {
        useAuth.setState({ user: updated, issue: null });
        setSaved(true); setEditing(false);
      }
    } catch (error) { setIssue(authError(error, t)); }
  });
  async function reload() {
    setReloading(true); setIssue(null);
    try { await useAuth.getState().reloadProfile(); }
    catch (error) { setIssue(authError(error, t)); }
    finally { setReloading(false); }
  }
  if (!user) return <Screen chrome={false}><StateView kind="error" title={t('profileUnavailable')}
    message={t('profileUnavailableBody')} /><Button title={t('retry')} onPress={reload} loading={reloading} />
    {issue ? <BodyText accessibilityRole="alert">{issue}</BodyText> : null}</Screen>;
  return <Screen chrome={false}>
    <Title>{t('personalInfo')}</Title>
    <Card style={{ padding: spacing.xxl, gap: spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <BodyText style={{ fontFamily: typography.bold, fontSize: 14, letterSpacing: 0.5 }}>{t('personalInfo').toLocaleUpperCase()}</BodyText>
        <Pressable accessibilityRole="button" accessibilityLabel={t(editing ? 'cancel' : 'editProfile')} disabled={isSubmitting}
          onPress={() => {
            if (editing) reset({ firstName: user.firstName, lastName: user.lastName ?? '', address: user.address ?? '' });
            setEditing(value => !value); setSaved(false); setIssue(null);
          }} style={{ width: 44, height: 44, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input }}>
          <Icon name={editing ? 'x' : 'pencil'} size={17} color={colors.accentText} />
        </Pressable>
      </View>
      <Controller control={control} name="firstName" rules={{ validate: (value) => isName(value) || t('invalidName') }}
        render={({ field }) => <Field label={t('firstName')} value={field.value} onChangeText={field.onChange}
          onBlur={field.onBlur} autoComplete="given-name" editable={editing && !isSubmitting} error={errors.firstName?.message} />} />
      <Controller control={control} name="lastName" rules={{ validate: (value) => value.trim() === '' || isName(value) || t('invalidName') }}
        render={({ field }) => <Field label={t('lastName')} value={field.value} onChangeText={field.onChange}
          onBlur={field.onBlur} autoComplete="family-name" editable={editing && !isSubmitting} error={errors.lastName?.message} />} />
      <Field label={t('phone')} value={user.phone ?? ''} editable={false} accessibilityHint={t('phoneReadOnly')} />
      {editing && <BodyText style={{ color: colors.mutedText, fontSize: 12 }}>{t('phoneReadOnly')}</BodyText>}
      <Controller control={control} name="address" rules={{ validate: (value) => value.trim() === '' || isAddress(value) || t('invalidAddress') }}
        render={({ field }) => <Field label={t('address')} value={field.value} onChangeText={field.onChange}
          onBlur={field.onBlur} multiline numberOfLines={3} editable={editing && !isSubmitting} autoComplete="street-address" error={errors.address?.message} />} />
      {!user.email.endsWith('@phone.local') && <Field label={t('email')} value={user.email} editable={false} />}
      {issue ? <BodyText accessibilityRole="alert" style={{ color: colors.danger }}>{issue}</BodyText> : null}
      {saved ? <BodyText accessibilityRole="alert" style={{ color: colors.success }}>{t('saved')}</BodyText> : null}
      {editing && <Button title={t('save')} onPress={submit} loading={isSubmitting} />}
    </Card>
    <Card style={{ padding: spacing.xxl }}>
      <BodyText style={{ fontFamily: typography.semibold }}>{t('support')}</BodyText>
      <Button title={t('contactSupport')} variant="secondary" onPress={() => router.push('/support')} />
      <BodyText style={{ color: colors.mutedText, fontSize: 12 }}>{t('accountDeletionBody')}</BodyText>
    </Card>
  </Screen>;
}
export default function EditProfileScreen() { return <RequireAuth><EditProfileContent /></RequireAuth>; }
