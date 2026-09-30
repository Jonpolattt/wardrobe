import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { isAddress, isName } from '@wardrobe/validation';
import { RequireAuth } from '../../components/RequireAuth';
import { BodyText, Button, Card, Field, Screen, StateView, Title } from '../../components/ui';
import { mobileApi } from '../../services/api';
import { useAuth } from '../../store/auth';
import { authError } from '../../features/auth/forms';

interface EditForm { firstName: string; lastName: string; address: string; }
function EditProfileContent() {
  const { t } = useTranslation('auth');
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
        setSaved(true);
      }
    } catch (error) { setIssue(authError(error, t)); }
  });
  async function reload() {
    setReloading(true); setIssue(null);
    try { await useAuth.getState().reloadProfile(); }
    catch (error) { setIssue(authError(error, t)); }
    finally { setReloading(false); }
  }
  if (!user) return <Screen><StateView kind="error" title={t('profileUnavailable')}
    message={t('profileUnavailableBody')} /><Button title={t('retry')} onPress={reload} loading={reloading} />
    {issue ? <BodyText accessibilityRole="alert">{issue}</BodyText> : null}</Screen>;
  return (
    <Screen><Title>{t('editProfile')}</Title><Card>
      <Controller control={control} name="firstName" rules={{ validate: (value) => isName(value) || t('invalidName') }}
        render={({ field }) => <Field label={t('firstName')} value={field.value} onChangeText={field.onChange}
          onBlur={field.onBlur} autoComplete="given-name" error={errors.firstName?.message} />} />
      <Controller control={control} name="lastName" rules={{ validate: (value) => value.trim() === '' || isName(value) || t('invalidName') }}
        render={({ field }) => <Field label={t('lastName')} value={field.value} onChangeText={field.onChange}
          onBlur={field.onBlur} autoComplete="family-name" error={errors.lastName?.message} />} />
      <Field label={t('phone')} value={user.phone ?? ''} editable={false} accessibilityHint={t('phoneReadOnly')} />
      <BodyText>{t('phoneReadOnly')}</BodyText>
      <Controller control={control} name="address" rules={{ validate: (value) => value.trim() === '' || isAddress(value) || t('invalidAddress') }}
        render={({ field }) => <Field label={t('address')} value={field.value} onChangeText={field.onChange}
          onBlur={field.onBlur} multiline numberOfLines={3} autoComplete="street-address" error={errors.address?.message} />} />
      {issue ? <BodyText accessibilityRole="alert">{issue}</BodyText> : null}
      {saved ? <BodyText accessibilityRole="alert">{t('saved')}</BodyText> : null}
      <Button title={t('save')} onPress={submit} loading={isSubmitting} />
    </Card></Screen>
  );
}
export default function EditProfileScreen() { return <RequireAuth><EditProfileContent /></RequireAuth>; }
