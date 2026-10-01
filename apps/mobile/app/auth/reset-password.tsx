import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { isPassword, OTP_REGEX } from '@wardrobe/validation';
import { BodyText, Button, TextAction, FormCard, FormTitle, Field, Screen, StateView, Title } from '../../components/ui';
import { mobileApi } from '../../services/api';
import { useAuth } from '../../store/auth';
import { authError, useAuthRequestGuard, useRemainingSeconds } from '../../features/auth/forms';

interface ResetForm { code: string; newPassword: string; confirmation: string; }
export default function ResetPasswordScreen() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const captureRequest = useAuthRequestGuard();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  // Email link tokens stay in route memory; never render, log or persist them.
  // The existing backend issues exactly 32 random bytes encoded as hex.
  // Reject repeated/malformed parameters instead of choosing one token.
  const invalidTokenParam = params.token !== undefined
    && (typeof params.token !== 'string' || params.token.length !== 64 || !/^[a-f0-9]{64}$/i.test(params.token));
  const token = !invalidTokenParam && typeof params.token === 'string' ? params.token : undefined;
  const pending = useAuth((state) => state.pendingRecovery);
  const phoneRecovery = !token && pending?.method === 'PHONE' ? pending : null;
  const cooldown = useRemainingSeconds(phoneRecovery?.sentAt, 60);
  const expiry = useRemainingSeconds(phoneRecovery?.sentAt, 15 * 60);
  const [issue, setIssue] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const { control, handleSubmit, getValues, reset, formState: { errors, isSubmitting } } = useForm<ResetForm>({
    defaultValues: { code: '', newPassword: '', confirmation: '' },
  });
  const submit = handleSubmit(async (values) => {
    if (invalidTokenParam || (!token && !phoneRecovery)) return;
    const request = captureRequest();
    setIssue(null);
    try {
      const payload = await mobileApi.resetPassword(token
        ? { token, newPassword: values.newPassword }
        : { identifier: phoneRecovery!.identifier, code: values.code, newPassword: values.newPassword });
      if (!request.isCurrent() || (phoneRecovery && useAuth.getState().pendingRecovery !== phoneRecovery)) return;
      await useAuth.getState().setSession(payload, request.sessionKey);
      if (!request.isFocused()) return;
      reset();
      router.replace('/(tabs)/profile');
    } catch (error) { if (request.isFocused()) setIssue(authError(error, t, 'resetInvalid')); }
  });
  async function resend() {
    if (!phoneRecovery || cooldown > 0 || resending) return;
    const request = captureRequest();
    setIssue(null); setResending(true);
    try {
      const result = await mobileApi.requestReset(phoneRecovery.identifier);
      if (!request.isCurrent() || useAuth.getState().pendingRecovery !== phoneRecovery) return;
      if (result.method === 'PHONE') {
        useAuth.getState().beginRecovery(phoneRecovery.identifier, 'PHONE');
        reset({ ...getValues(), code: '' });
      } else { setIssue(t('resetSentEmail')); }
    } catch (error) { if (request.isFocused()) setIssue(authError(error, t)); }
    finally { setResending(false); }
  }
  if (invalidTokenParam) return <Screen chrome={false}><StateView kind="error" title={t('resetInvalid')} />
    <Button title={t('requestReset')} onPress={() => router.replace('/auth/forgot-password')} /></Screen>;
  if (!token && !phoneRecovery) return <Screen chrome={false}><StateView kind="empty" title={t('resetMissing')} />
    <Button title={t('requestReset')} onPress={() => router.replace('/auth/forgot-password')} /></Screen>;
  return (
    <Screen chrome={false}><FormCard><FormTitle>{t('resetTitle')}</FormTitle>{phoneRecovery ? <BodyText>{t('resetSentPhone')}</BodyText> : null}
        {phoneRecovery ? <Controller control={control} name="code"
          rules={{ validate: (value) => OTP_REGEX.test(value) || t('invalidCode') }}
          render={({ field }) => <Field label={t('code')} value={field.value} onChangeText={field.onChange}
            onBlur={field.onBlur} keyboardType="number-pad" maxLength={5} textContentType="oneTimeCode"
            autoComplete="sms-otp" error={errors.code?.message} />} /> : null}
        <Controller control={control} name="newPassword" rules={{ validate: (value) => isPassword(value) || t('invalidPassword') }}
          render={({ field }) => <Field label={t('newPassword')} value={field.value} onChangeText={field.onChange}
            onBlur={field.onBlur} secureTextEntry autoCapitalize="none" autoCorrect={false}
            autoComplete="new-password" error={errors.newPassword?.message} />} />
        <Controller control={control} name="confirmation" rules={{ validate: (value) => value === getValues('newPassword') || t('passwordsDiffer') }}
          render={({ field }) => <Field label={t('confirmPassword')} value={field.value} onChangeText={field.onChange}
            onBlur={field.onBlur} secureTextEntry autoCapitalize="none" autoCorrect={false}
            error={errors.confirmation?.message} />} />
        {phoneRecovery && expiry === 0 ? <BodyText accessibilityRole="alert">{t('resetExpired')}</BodyText> : null}
        {issue ? <BodyText accessibilityRole="alert">{issue}</BodyText> : null}
        <Button title={t('resetPassword')} onPress={submit} loading={isSubmitting}
          disabled={resending || (!!phoneRecovery && expiry === 0)} />
        {phoneRecovery ? <Button title={cooldown > 0 ? t('resendIn', { seconds: cooldown }) : t('resend')}
          onPress={resend} variant="secondary" loading={resending} disabled={cooldown > 0 || isSubmitting} /> : null}
      </FormCard><TextAction title={t('backToLogin')} onPress={() => router.replace('/auth/login')} />
    </Screen>
  );
}
