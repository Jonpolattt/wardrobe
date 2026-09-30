import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { isIdentifier, isPassword } from '@wardrobe/validation';
import { BodyText, Button, Card, Field, Screen, Title } from '../../components/ui';
import { mobileApi } from '../../services/api';
import { useAuth } from '../../store/auth';
import { authError, normalizeIdentifier, signedInDestination, useAuthRequestGuard } from '../../features/auth/forms';

interface LoginForm { identifier: string; password: string; }
export default function LoginScreen() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const captureRequest = useAuthRequestGuard();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const [issue, setIssue] = useState<string | null>(null);
  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    defaultValues: { identifier: '', password: '' },
  });
  const submit = handleSubmit(async (values) => {
    const request = captureRequest();
    setIssue(null);
    try {
      const payload = await mobileApi.login({ identifier: normalizeIdentifier(values.identifier), password: values.password });
      if (!request.isCurrent()) return;
      await useAuth.getState().setSession(payload, request.sessionKey);
      if (!request.isFocused()) return;
      reset();
      router.replace(signedInDestination(returnTo));
    } catch (error) { if (request.isFocused()) setIssue(authError(error, t, 'invalidCredentials')); }
  });
  return (
    <Screen><Title>{t('login')}</Title><Card>
      <Controller control={control} name="identifier" rules={{ validate: (value) => isIdentifier(value) || t('invalidIdentifier') }}
        render={({ field }) => <Field label={t('identifier')} value={field.value} onChangeText={field.onChange}
          onBlur={field.onBlur} autoCapitalize="none" autoCorrect={false} autoComplete="username"
          error={errors.identifier?.message} />} />
      <Controller control={control} name="password" rules={{ validate: (value) => isPassword(value) || t('invalidPassword') }}
        render={({ field }) => <Field label={t('password')} value={field.value} onChangeText={field.onChange}
          onBlur={field.onBlur} secureTextEntry autoCapitalize="none" autoCorrect={false}
          autoComplete="current-password" error={errors.password?.message} />} />
      {issue ? <BodyText accessibilityRole="alert">{issue}</BodyText> : null}
      <Button title={t('login')} onPress={submit} loading={isSubmitting} />
    </Card>
      <Button title={t('forgotPassword')} variant="secondary" onPress={() => router.push('/auth/forgot-password')} />
      <Button title={t('noAccount')} variant="secondary" onPress={() => router.push('/auth/register')} />
    </Screen>
  );
}
