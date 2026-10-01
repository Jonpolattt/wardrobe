import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { isIdentifier } from '@wardrobe/validation';
import { BodyText, Button, TextAction, FormCard, FormTitle, Field, Screen, Title } from '../../components/ui';
import { mobileApi } from '../../services/api';
import { useAuth } from '../../store/auth';
import { authError, normalizeIdentifier, useAuthRequestGuard } from '../../features/auth/forms';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const captureRequest = useAuthRequestGuard();
  const [issue, setIssue] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ identifier: string }>({
    defaultValues: { identifier: '' },
  });
  const submit = handleSubmit(async ({ identifier }) => {
    const request = captureRequest();
    setIssue(null); setEmailSent(false);
    const normalized = normalizeIdentifier(identifier);
    try {
      const result = await mobileApi.requestReset(normalized);
      if (!request.isCurrent()) return;
      const method = result.method === 'PHONE' ? 'PHONE' : 'EMAIL';
      useAuth.getState().beginRecovery(normalized, method);
      if (method === 'PHONE') router.push('/auth/reset-password');
      else setEmailSent(true);
    } catch (error) { if (request.isFocused()) setIssue(authError(error, t)); }
  });
  return (
    <Screen chrome={false}><FormCard><FormTitle>{t('resetTitle')}</FormTitle>
      <Controller control={control} name="identifier" rules={{ validate: (value) => isIdentifier(value) || t('invalidIdentifier') }}
        render={({ field }) => <Field label={t('identifier')} value={field.value} onChangeText={field.onChange}
          onBlur={field.onBlur} autoCapitalize="none" autoCorrect={false} error={errors.identifier?.message} />} />
      {issue ? <BodyText accessibilityRole="alert">{issue}</BodyText> : null}
      {emailSent ? <BodyText accessibilityRole="alert">{t('resetSentEmail')}</BodyText> : null}
      <Button title={t('requestReset')} onPress={submit} loading={isSubmitting} />
    </FormCard><TextAction title={t('backToLogin')} onPress={() => router.replace('/auth/login')} />
    </Screen>
  );
}
