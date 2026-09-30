import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { isName } from '@wardrobe/validation';
import { BodyText, Button, Card, Field, Screen, Title } from '../components/ui';
import { mobileApi } from '../services/api';
import { useAuth } from '../store/auth';
import { authError } from '../features/auth/forms';

interface SupportForm { name: string; contact: string; message: string; }
export default function SupportScreen() {
  const { t } = useTranslation('auth');
  const user = useAuth((state) => state.user);
  const [issue, setIssue] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const settings = useQuery({ queryKey: ['public', 'site-settings'], queryFn: ({ signal }) => mobileApi.siteSettings(signal) });
  const { control, handleSubmit, reset, getValues, formState: { errors, isSubmitting } } = useForm<SupportForm>({
    defaultValues: { name: [user?.firstName, user?.lastName].filter(Boolean).join(' '), contact: user?.phone ?? '', message: '' },
  });
  const submit = handleSubmit(async (values) => {
    setIssue(null); setSent(false);
    try {
      const accepted = await mobileApi.contact({ name: values.name.trim(), contact: values.contact.trim(), message: values.message.trim() });
      if (!accepted) { setIssue(t('supportFailed')); return; }
      setSent(true);
      reset({ ...getValues(), message: '' });
    } catch (error) { setIssue(authError(error, t, 'supportFailed')); }
  });
  return (
    <Screen><Title>{t('support')}</Title><BodyText>{t('supportIntro')}</BodyText>
      {settings.data ? <Card>
        {settings.data.contactPhone ? <BodyText>{settings.data.contactPhone}</BodyText> : null}
        {settings.data.contactTelegram ? <BodyText>{settings.data.contactTelegram}</BodyText> : null}
        {settings.data.contactEmail ? <BodyText>{settings.data.contactEmail}</BodyText> : null}
        {settings.data.contactAddress ? <BodyText>{settings.data.contactAddress}</BodyText> : null}
      </Card> : null}
      <Card><Controller control={control} name="name" rules={{ validate: (value) => (isName(value) && value.length <= 100) || t('invalidName') }}
        render={({ field }) => <Field label={t('firstName')} value={field.value} onChangeText={field.onChange}
          onBlur={field.onBlur} maxLength={100} error={errors.name?.message} />} />
        <Controller control={control} name="contact" rules={{ validate: (value) => (value.trim().length > 0 && value.length <= 100) || t('invalidContact') }}
          render={({ field }) => <Field label={t('contact')} value={field.value} onChangeText={field.onChange}
            onBlur={field.onBlur} maxLength={100} autoCapitalize="none" error={errors.contact?.message} />} />
        <Controller control={control} name="message" rules={{ validate: (value) => (value.trim().length > 0 && value.length <= 2000) || t('invalidMessage') }}
          render={({ field }) => <Field label={t('message')} value={field.value} onChangeText={field.onChange}
            onBlur={field.onBlur} multiline numberOfLines={6} maxLength={2000}
            style={{ minHeight: 140, textAlignVertical: 'top' }} error={errors.message?.message} />} />
        {issue ? <BodyText accessibilityRole="alert">{issue}</BodyText> : null}
        {sent ? <BodyText accessibilityRole="alert">{t('messageSent')}. {t('messageSentBody')}</BodyText> : null}
        <Button title={t('sendMessage')} onPress={submit} loading={isSubmitting} />
      </Card>
    </Screen>
  );
}
