'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { useMutation } from '@apollo/client';
import { motion } from 'framer-motion';
import { RESET_PASSWORD } from '@/lib/graphql/mutations';
import { useAuthStore } from '@/lib/store/auth-store';
import { getFriendlyErrorMessage } from '@/lib/utils/graphql-error';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { MOCK_AUTH_FALLBACK, mockAuthPayload } from '@/lib/utils/mock-auth';
import type { Locale } from '@/i18n/config';
import uzDict from '@/i18n/dictionaries/uz.json';
import ruDict from '@/i18n/dictionaries/ru.json';

interface ResetForm {
  code: string;
  newPassword: string;
  confirmNewPassword: string;
}

// useSearchParams() opts the calling component out of static prerendering
// unless it's wrapped in <Suspense> — same requirement as verify-email/page.tsx.
export default function ResetPasswordPage({ params }: { params: { locale: Locale } }) {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner params={params} />
    </Suspense>
  );
}

function ResetPasswordInner({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const dict = locale === 'ru' ? ruDict : uzDict;
  const router = useRouter();
  const searchParams = useSearchParams();
  // Two mutually-exclusive arrival shapes, matching the two forgot-password
  // branches: a `token` means the buyer clicked the emailed link (no code
  // to type — the token alone proves it's them); an `identifier` means they
  // came from the phone/SMS path and still need to enter the 6-digit code.
  const token = searchParams.get('token') ?? '';
  const identifier = searchParams.get('identifier') ?? '';
  const isTokenFlow = Boolean(token);
  const setSession = useAuthStore((s) => s.setSession);

  const [error, setError] = useState<string | null>(null);
  const [resetPassword, { loading }] = useMutation(RESET_PASSWORD);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetForm>();

  const newPassword = watch('newPassword');

  async function onSubmit(values: ResetForm) {
    setError(null);
    try {
      const input = isTokenFlow
        ? { token, newPassword: values.newPassword }
        : { identifier, code: values.code, newPassword: values.newPassword };
      const { data } = await resetPassword({ variables: { input } });
      setSession(data.resetPassword);
      router.push(data.resetPassword.user.role === 'ADMIN' ? `/${locale}/admin` : `/${locale}`);
    } catch (e: any) {
      // See mock-auth.ts — no backend reachable yet, so log the buyer in
      // with fabricated data instead of getting stuck on a network error.
      if (MOCK_AUTH_FALLBACK) {
        setSession(mockAuthPayload(isTokenFlow ? {} : { email: identifier.includes('@') ? identifier : undefined }));
        router.push(`/${locale}`);
        return;
      }
      setError(getFriendlyErrorMessage(e));
    }
  }

  if (!isTokenFlow && !identifier) {
    return (
      <div className="container-app flex min-h-[70vh] items-center justify-center py-16 text-center text-sm text-ink-900/50">
        {dict.auth.verifyMissingEmail}
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
        <h1 className="font-display text-2xl font-medium">{dict.auth.resetTitle}</h1>
        <p className="mt-2 text-sm text-ink-900/60">
          {isTokenFlow ? (
            dict.auth.resetSubtitleToken
          ) : (
            <>
              {dict.auth.resetSubtitlePhone} <span className="font-semibold">{identifier}</span>
            </>
          )}
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
          {!isTokenFlow && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.auth.codeLabel}</label>
              <input
                inputMode="numeric"
                maxLength={5}
                placeholder="12345"
                {...register('code', { required: true, minLength: 5, maxLength: 5 })}
                className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-center text-lg font-bold tracking-[0.5em] outline-none focus:border-ink-950"
              />
              {errors.code && <p className="mt-1 text-xs text-red-500">{dict.auth.codeInvalidLength}</p>}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.auth.newPassword}</label>
            <PasswordInput {...register('newPassword', { required: true, minLength: 6 })} />
            {errors.newPassword && <p className="mt-1 text-xs text-red-500">Kamida 6 belgi</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.auth.confirmNewPassword}</label>
            <PasswordInput
              {...register('confirmNewPassword', {
                required: true,
                validate: (value) => value === newPassword || (dict.auth.passwordMismatch as string),
              })}
            />
            {errors.confirmNewPassword && (
              <p className="mt-1 text-xs text-red-500">{errors.confirmNewPassword.message || dict.auth.passwordMismatch}</p>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? '…' : dict.auth.resetButton}
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
