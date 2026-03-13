'use client';

import { useEffect, useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { setLocaleForClinicianSite } from '@/i18n/actions';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useRateLimit } from '@/hooks/useRateLimit';

export default function MfaVerifyPage() {
  const t = useTranslations();
  const router = useRouter();
  const supabase = createClient();

  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const { isLockedOut, secondsRemaining, recordFailure, resetAttempts } = useRateLimit();

  useEffect(() => {
    initChallenge();
  }, []);

  async function initChallenge() {
    try {
      // Get enrolled factors
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();

      if (factorsError) {
        console.error('Error listing factors:', factorsError);
        // No factors — redirect to enrol
        router.push('/mfa/enroll');
        return;
      }

      const totpFactors = factorsData?.totp ?? [];
      if (totpFactors.length === 0) {
        router.push('/mfa/enroll');
        return;
      }

      const factor = totpFactors[0];
      setFactorId(factor.id);

      // Create challenge
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: factor.id });

      if (challengeError) {
        console.error('Error creating challenge:', challengeError);
        setError(t('mfa.invalidCode'));
        setLoading(false);
        return;
      }

      setChallengeId(challengeData.id);
      setLoading(false);

      // Focus the input
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err) {
      console.error('MFA init error:', err);
      setLoading(false);
    }
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || !challengeId || code.length !== 6 || isLockedOut) return;

    setError(null);
    startTransition(async () => {
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      });

      if (verifyError) {
        recordFailure();
        setError(t('mfa.invalidCode'));
        setCode('');
        inputRef.current?.focus();

        // Create a new challenge for retry
        const { data: newChallenge } = await supabase.auth.mfa.challenge({ factorId });
        if (newChallenge) {
          setChallengeId(newChallenge.id);
        }
        return;
      }

      // Success — session is now aal2
      resetAttempts();
      await setLocaleForClinicianSite();
      window.location.href = '/';
    });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f5f0] gap-3">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] px-4">
      <div className="absolute top-3 right-3">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-[#1a1a1a] mb-1">
            {t('mfa.verifyTitle')}
          </h1>
          <p className="text-xs text-[#888]">{t('mfa.verifySubtitle')}</p>
        </div>

        {/* Code form */}
        <form
          onSubmit={handleVerify}
          className="bg-white rounded-xl border border-[#d0d0c8] shadow-sm p-6 space-y-4"
        >
          <div>
            <label
              htmlFor="mfa-code"
              className="block text-xs font-semibold text-[#555] mb-1"
            >
              {t('mfa.codeLabel')}
            </label>
            <input
              ref={inputRef}
              id="mfa-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(val);
              }}
              className="w-full px-3 py-2.5 rounded-lg border border-[#d0d0c8] text-sm text-center
                         tracking-[0.5em] font-mono text-lg
                         focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]
                         placeholder:text-[#ccc] placeholder:tracking-[0.5em]"
              placeholder={t('mfa.codePlaceholder')}
            />
          </div>

          {isLockedOut ? (
            <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {t('mfa.lockedOut', { seconds: secondsRemaining })}
            </div>
          ) : error ? (
            <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isPending || code.length !== 6 || isLockedOut}
            className="w-full py-2.5 rounded-lg bg-[#c95a8a] text-white text-sm font-semibold
                       hover:bg-[#b44d7a] active:bg-[#a0426c] disabled:opacity-50
                       transition-colors cursor-pointer"
          >
            {isPending ? t('mfa.verifying') : t('mfa.verify')}
          </button>
        </form>

        {/* Sign out */}
        <div className="text-center mt-4">
          <button
            onClick={handleSignOut}
            className="text-xs text-[#999] hover:text-red-600 transition-colors"
          >
            {t('mfa.signOut')}
          </button>
        </div>
      </div>
    </div>
  );
}
