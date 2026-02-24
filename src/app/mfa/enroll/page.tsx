'use client';

import { useEffect, useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { cleanupUnverifiedFactors } from './actions';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function MfaEnrollPage() {
  const t = useTranslations();
  const router = useRouter();
  const supabase = createClient();

  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null); // base64 SVG data URI
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initEnrol();
  }, []);

  async function initEnrol() {
    try {
      // Check if user already has TOTP enrolled (listFactors returns only verified factors)
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totpFactors = factorsData?.totp ?? [];

      if (totpFactors.length > 0) {
        // Already enrolled — redirect to verify
        router.push('/mfa/verify');
        return;
      }

      // Clean up any stale unverified factors from previous incomplete enrolments.
      // We do this via a server action to use the admin API, since the client
      // listFactors() only returns verified factors.
      await cleanupUnverifiedFactors();

      // Enrol a new TOTP factor with a unique friendly name to avoid collisions
      const { data: enrollData, error: enrollError } =
        await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: `totp-${Date.now()}`,
        });

      if (enrollError) {
        console.error('MFA enrol error:', enrollError);
        setError(enrollError.message);
        setLoading(false);
        return;
      }

      setFactorId(enrollData.id);
      setQrCode(enrollData.totp.qr_code);
      setSecret(enrollData.totp.secret);
      setLoading(false);

      // Focus the code input after render
      setTimeout(() => inputRef.current?.focus(), 300);
    } catch (err) {
      console.error('MFA enrol error:', err);
      setLoading(false);
    }
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || code.length !== 6) return;

    setError(null);
    startTransition(async () => {
      // Create challenge and verify in one go
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });

      if (challengeError) {
        setError(t('mfa.invalidCode'));
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) {
        setError(t('mfa.invalidCode'));
        setCode('');
        inputRef.current?.focus();
        return;
      }

      // Success — MFA is now enrolled and session is aal2
      router.push('/');
      router.refresh();
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
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] px-4 py-8">
      <div className="absolute top-3 right-3">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-[#1a1a1a] mb-1">
            {t('mfa.enrollTitle')}
          </h1>
          <p className="text-xs text-[#888]">{t('mfa.enrollRequired')}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#d0d0c8] shadow-sm p-6 space-y-5">
          {/* Instructions */}
          <p className="text-xs text-[#666] text-center">
            {t('mfa.enrollSubtitle')}
          </p>

          {/* QR Code */}
          {qrCode && (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCode}
                alt="TOTP QR Code"
                className="w-48 h-48 rounded-lg border border-[#e8e8e0]"
              />
            </div>
          )}

          {/* Manual secret */}
          {secret && (
            <div className="text-center">
              <p className="text-[10px] text-[#999] mb-1">{t('mfa.secretLabel')}</p>
              <div className="inline-flex items-center gap-1.5">
                <code className="text-xs font-mono bg-[#f5f5f0] px-3 py-1.5 rounded border border-[#e8e8e0] select-all break-all">
                  {secret}
                </code>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(secret);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex-shrink-0 px-2 py-1.5 text-[10px] font-medium rounded border border-[#d0d0c8] bg-white
                             hover:bg-[#f0f0ea] active:bg-[#e8e8e0] transition-colors text-[#666]"
                >
                  {copied ? t('mfa.copied') : t('mfa.copySecret')}
                </button>
              </div>
            </div>
          )}

          {/* Verification form */}
          <form onSubmit={handleVerify} className="space-y-4 pt-2">
            <div>
              <label
                htmlFor="enrol-code"
                className="block text-xs font-semibold text-[#555] mb-1"
              >
                {t('mfa.codeLabel')}
              </label>
              <input
                ref={inputRef}
                id="enrol-code"
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

            {error && (
              <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending || code.length !== 6}
              className="w-full py-2.5 rounded-lg bg-[#c95a8a] text-white text-sm font-semibold
                         hover:bg-[#b44d7a] active:bg-[#a0426c] disabled:opacity-50
                         transition-colors cursor-pointer"
            >
              {isPending ? t('mfa.verifying') : t('mfa.enrollVerify')}
            </button>
          </form>
        </div>

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
