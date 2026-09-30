'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { useMutation } from '@apollo/client';
import { motion } from 'framer-motion';
import { REQUEST_PASSWORD_RESET } from '@/lib/graphql/mutations';
import { getFriendlyErrorMessage } from '@/lib/utils/graphql-error';
import { MOCK_AUTH_FALLBACK, mockDetectIdentifierType } from '@/lib/utils/mock-auth';
import type { Locale } from '@/i18n/config';
import uzDict from '@/i18n/dictionaries/uz.json';
import ruDict from '@/i18n/dictionaries/ru.json';

interface ForgotForm {
  identifier: string;
}

export default function ForgotPasswordPage({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const dict = locale === 'ru' ? ruDict : uzDict;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // EMAIL path has no further screen to navigate to (the reset link goes
  // straight to /reset-password?token=...) — this just tells the buyer to
  // go check their inbox instead.
  const [emailSent, setEmailSent] = useState(false);

  const [requestReset, { loading }] = useMutation(REQUEST_PASSWORD_RESET);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>();

  async function onSubmit(values: ForgotForm) {
    setError(null);
    try {
      const { data } = await requestReset({ variables: { input: values } });
      if (data.requestPasswordReset.method === 'EMAIL') {
        setEmailSent(true);
        return;
      }
      const params = new URLSearchParams({ identifier: values.identifier });
      router.push(`/${locale}/reset-password?${params.toString()}`);
    } catch (e: any) {
      // See mock-auth.ts — no backend reachable yet, so route to the next
      // screen exactly as a real success would, based on what the typed
      // identifier looks like.
      if (MOCK_AUTH_FALLBACK) {
        if (mockDetectIdentifierType(values.identifier) === 'EMAIL') {
          setEmailSent(true);
          return;
        }
        const params = new URLSearchParams({ identifier: values.identifier });
        router.push(`/${locale}/reset-password?${params.toString()}`);
        return;
      }
      setError(getFriendlyErrorMessage(e));
    }
  }

  if (emailSent) {
    return (
      <div className="container-app flex min-h-[70vh] items-center justify-center py-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="card-surface w-full max-w-md p-8 text-center"
        >
          <h1 className="font-display text-2xl font-medium">{dict.auth.forgotEmailSentTitle}</h1>
          <p className="mt-3 text-sm text-ink-900/60">{dict.auth.forgotEmailSentBody}</p>

          <Link href={`/${locale}/login`} className="btn-outline mt-8 inline-block w-full">
            {dict.auth.backToLogin}
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container-app flex min-h-[70vh] items-center justify-center py-16">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="card-surface w-full max-w-md p-8"
      >
        <h1 className="font-display text-2xl font-medium">{dict.auth.forgotTitle}</h1>
        <p className="mt-2 text-sm text-ink-900/60">{dict.auth.forgotSubtitleNew}</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.auth.identifierLabel}</label>
            <input
              {...register('identifier', { required: true })}
              className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
            />
            {errors.identifier && <p className="mt-1 text-xs text-red-500">{dict.auth.identifierRequired}</p>}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? '…' : dict.auth.forgotButton}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-900/60">
          <Link href={`/${locale}/login`} className="font-semibold text-ink-950 underline">
            {dict.auth.backToLogin}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
