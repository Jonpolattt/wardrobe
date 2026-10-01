import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { isName, isPassword, isRegistrationEmail, isUzPhone, normalizeUzPhone } from '@wardrobe/validation';
import { BodyText, Button, TextAction, FormCard, FormTitle, Field, Screen, Title } from '../../components/ui';
import { mobileApi } from '../../services/api';
import { useAuth } from '../../store/auth';
import { authError, requireAuthSuccess, useAuthRequestGuard, useRemainingSeconds } from '../../features/auth/forms';

export default function RegistrationScreen() {
  const pending = useAuth((state) => state.pendingRegistration);
  const remaining = useRemainingSeconds(pending?.verifiedAt, 30 * 60);
  return pending?.verifiedAt && remaining > 0 ? <PersonalInfo phone={pending.phone} />
    : <PhoneStep expired={!!pending?.verifiedAt} />;
}
function PhoneStep({ expired }: { expired: boolean }) {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const captureRequest = useAuthRequestGuard();
  const pending = useAuth((state) => state.pendingRegistration);
  const cooldown = useRemainingSeconds(pending?.sentAt, 60);
  const [issue, setIssue] = useState<string | null>(null);
  const { control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<{ phone: string }>({
    defaultValues: { phone: pending?.phone ?? '+998' },
  });
  const samePhone = normalizeUzPhone(watch('phone')) === pending?.phone;
  const submit = handleSubmit(async ({ phone }) => {
    const request = captureRequest();
    setIssue(null);
    const normalized = normalizeUzPhone(phone);
    try {
      requireAuthSuccess(await mobileApi.sendOtp(normalized));
      if (!request.isCurrent()) return;
      useAuth.getState().beginRegistration(normalized);
      router.push('/auth/verify');
    } catch (error) { if (request.isFocused()) setIssue(authError(error, t, 'phoneSendFailed')); }
  });
  return (
    <Screen chrome={false}><FormCard><FormTitle>{t('register')}</FormTitle><BodyText>{t(expired ? 'registrationExpired' : 'verifyFirst')}</BodyText><Controller control={control} name="phone" rules={{ validate: (value) => isUzPhone(value) || t('invalidPhone') }}
        render={({ field }) => <Field label={t('phone')} value={field.value} onChangeText={field.onChange}
          onBlur={field.onBlur} keyboardType="phone-pad" autoComplete="tel" error={errors.phone?.message} />} />
        {issue ? <BodyText accessibilityRole="alert">{issue}</BodyText> : null}
        <Button title={samePhone && cooldown > 0 ? t('resendIn', { seconds: cooldown }) : t('sendCode')}
          onPress={submit} loading={isSubmitting} disabled={samePhone && cooldown > 0} />
        {pending && samePhone && !pending.verifiedAt ? <Button title={t('continue')} variant="secondary"
          onPress={() => router.push('/auth/verify')} /> : null}
      </FormCard><TextAction title={t('alreadyAccount')} onPress={() => router.push('/auth/login')} />
    </Screen>
  );
}
interface PersonalForm { firstName: string; lastName: string; email: string; password: string; confirmation: string; }
function PersonalInfo({ phone }: { phone: string }) {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const captureRequest = useAuthRequestGuard();
  const [issue, setIssue] = useState<string | null>(null);
  const { control, handleSubmit, getValues, reset, formState: { errors, isSubmitting } } = useForm<PersonalForm>({
    defaultValues: { firstName: '', lastName: '', email: '', password: '', confirmation: '' },
  });
  const submit = handleSubmit(async (values) => {
    const request = captureRequest();
    const pendingAtStart = useAuth.getState().pendingRegistration;
    if (!pendingAtStart?.verifiedAt || pendingAtStart.phone !== phone) return;
    setIssue(null);
    try {
      const payload = await mobileApi.register({ phone, firstName: values.firstName.trim(),
        lastName: values.lastName.trim(), password: values.password,
        ...(values.email.trim() ? { email: values.email.trim().toLowerCase() } : {}) });
      if (!request.isCurrent() || useAuth.getState().pendingRegistration !== pendingAtStart) return;
      await useAuth.getState().setSession(payload, request.sessionKey);
      if (!request.isFocused()) return;
      reset();
      router.replace('/(tabs)/profile');
    } catch (error) { if (request.isFocused()) setIssue(authError(error, t, 'registrationFailed')); }
  });
  return (
    <Screen chrome={false}><FormCard><FormTitle>{t('completeRegistration')}</FormTitle><BodyText>{t('phoneVerified')}: {phone}</BodyText>
      <Controller control={control} name="firstName" rules={{ validate: (value) => isName(value) || t('invalidName') }}
        render={({ field }) => <Field label={t('firstName')} value={field.value} onChangeText={field.onChange}
          onBlur={field.onBlur} autoComplete="given-name" error={errors.firstName?.message} />} />
      <Controller control={control} name="lastName" rules={{ validate: (value) => isName(value) || t('invalidName') }}
        render={({ field }) => <Field label={t('lastName')} value={field.value} onChangeText={field.onChange}
          onBlur={field.onBlur} autoComplete="family-name" error={errors.lastName?.message} />} />
      <Controller control={control} name="email" rules={{ validate: (value) => isRegistrationEmail(value) || t('invalidEmail') }}
        render={({ field }) => <Field label={t('emailOptional')} value={field.value} onChangeText={field.onChange}
          onBlur={field.onBlur} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
          autoComplete="email" error={errors.email?.message} />} />
      <Controller control={control} name="password" rules={{ validate: (value) => isPassword(value) || t('invalidPassword') }}
        render={({ field }) => <Field label={t('password')} value={field.value} onChangeText={field.onChange}
          onBlur={field.onBlur} secureTextEntry autoCapitalize="none" autoCorrect={false}
          autoComplete="new-password" error={errors.password?.message} />} />
      <Controller control={control} name="confirmation" rules={{ validate: (value) => value === getValues('password') || t('passwordsDiffer') }}
        render={({ field }) => <Field label={t('confirmPassword')} value={field.value} onChangeText={field.onChange}
          onBlur={field.onBlur} secureTextEntry autoCapitalize="none" autoCorrect={false} error={errors.confirmation?.message} />} />
      {issue ? <BodyText accessibilityRole="alert">{issue}</BodyText> : null}
      <BodyText>{t('termsHint')}</BodyText><Button title={t('createAccount')} onPress={submit} loading={isSubmitting} />
    </FormCard><TextAction title={t('changePhone')} disabled={isSubmitting}
      onPress={() => useAuth.getState().clearPending()} />
    </Screen>
  );
}
