'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { useRateLimit } from '@/hooks/useRateLimit';

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { isLockedOut, secondsRemaining, recordFailure } = useRateLimit();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) return;
    setError(null);

    startTransition(async () => {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      );

      if (resetError) {
        recordFailure();
        setError(t('forgotPassword.error'));
        return;
      }

      // Always show success, even if email doesn't exist (security)
      setSent(true);
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] px-4">
      <div className="absolute top-3 right-3">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-[#1a1a1a] mb-1">
            {t('forgotPassword.title')}
          </h1>
          <p className="text-xs text-[#888]">{t('forgotPassword.subtitle')}</p>
        </div>

        {sent ? (
          /* Success state */
          <div className="bg-white rounded-xl border border-[#d0d0c8] shadow-sm p-6 space-y-4">
            <div className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">
              {t('forgotPassword.success')}
            </div>
            <Link
              href="/login"
              className="block text-center text-sm text-[#c95a8a] hover:text-[#b44d7a] font-semibold"
            >
              {t('forgotPassword.backToLogin')}
            </Link>
          </div>
        ) : (
          /* Email form */
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl border border-[#d0d0c8] shadow-sm p-6 space-y-4"
          >
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-[#555] mb-1"
              >
                {t('forgotPassword.emailLabel')}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#d0d0c8] text-sm
                           focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]
                           placeholder:text-[#aaa]"
                placeholder={t('login.emailPlaceholder')}
              />
            </div>

            {isLockedOut ? (
              <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {t('login.lockedOut', { seconds: secondsRemaining })}
              </div>
            ) : error ? (
              <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isPending || isLockedOut}
              className="w-full py-2.5 rounded-lg bg-[#c95a8a] text-white text-sm font-semibold
                         hover:bg-[#b44d7a] active:bg-[#a0426c] disabled:opacity-50
                         transition-colors cursor-pointer"
            >
              {isPending
                ? t('forgotPassword.sending')
                : t('forgotPassword.submit')}
            </button>

            <Link
              href="/login"
              className="block text-center text-xs text-[#888] hover:text-[#555]"
            >
              {t('forgotPassword.backToLogin')}
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
