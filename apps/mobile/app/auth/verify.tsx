import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { OTP_REGEX } from '@wardrobe/validation';
import { BodyText, Button, Card, Field, Screen, StateView, Title } from '../../components/ui';
import { mobileApi } from '../../services/api';
import { useAuth } from '../../store/auth';
import { authError, requireAuthSuccess, useAuthRequestGuard, useRemainingSeconds } from '../../features/auth/forms';

export default function VerifyScreen() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const captureRequest = useAuthRequestGuard();
  const pending = useAuth((state) => state.pendingRegistration);
  const cooldown = useRemainingSeconds(pending?.sentAt, 60);
  const expiry = useRemainingSeconds(pending?.sentAt, 5 * 60);
  const [issue, setIssue] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<{ code: string }>({ defaultValues: { code: '' } });
  const submit = handleSubmit(async ({ code }) => {
    if (!pending) return;
    const request = captureRequest();
    setIssue(null);
    try {
      requireAuthSuccess(await mobileApi.verifyOtp(pending.phone, code));
      if (!request.isCurrent() || useAuth.getState().pendingRegistration !== pending) return;
      useAuth.getState().markRegistrationVerified();
      reset();
      router.replace('/auth/register');
    } catch (error) { if (request.isFocused()) setIssue(authError(error, t, 'otpInvalid')); }
  });
  async function resend() {
    if (!pending || cooldown > 0 || resending) return;
    const request = captureRequest();
    setIssue(null); setResending(true);
    try {
      requireAuthSuccess(await mobileApi.sendOtp(pending.phone));
      if (!request.isCurrent() || useAuth.getState().pendingRegistration !== pending) return;
      useAuth.getState().beginRegistration(pending.phone);
      reset();
    } catch (error) { if (request.isFocused()) setIssue(authError(error, t, 'phoneSendFailed')); }
    finally { setResending(false); }
  }
  if (!pending) return <Screen><StateView kind="empty" title={t('verifyFirst')} />
    <Button title={t('register')} onPress={() => router.replace('/auth/register')} /></Screen>;
  return (
    <Screen><Title>{t('verify')}</Title><BodyText>{t('otpSent', { phone: pending.phone })}</BodyText>
      <BodyText>{t('otpHelp')}</BodyText><Card>
        <Controller control={control} name="code" rules={{ validate: (value) => OTP_REGEX.test(value) || t('invalidCode') }}
          render={({ field }) => <Field label={t('code')} value={field.value} onChangeText={field.onChange}
            onBlur={field.onBlur} keyboardType="number-pad" maxLength={5} autoComplete="sms-otp"
            textContentType="oneTimeCode" error={errors.code?.message} />} />
        {expiry === 0 ? <BodyText accessibilityRole="alert">{t('otpExpired')}</BodyText> : null}
        {issue ? <BodyText accessibilityRole="alert">{issue}</BodyText> : null}
        <Button title={t('verify')} onPress={submit} loading={isSubmitting} disabled={resending || expiry === 0} />
        <Button title={cooldown > 0 ? t('resendIn', { seconds: cooldown }) : t('resend')}
          onPress={resend} variant="secondary" loading={resending} disabled={cooldown > 0 || isSubmitting} />
      </Card><Button title={t('changePhone')} variant="secondary" disabled={isSubmitting || resending}
        onPress={() => { useAuth.getState().clearPending(); router.replace('/auth/register'); }} />
    </Screen>
  );
}
