'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { resetPassword } from './actions';

export default function ResetPasswordPage() {
  const t = useTranslations();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError(t('resetPassword.tooShort'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('resetPassword.mismatch'));
      return;
    }

    startTransition(async () => {
      const result = await resetPassword(newPassword);

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccess(true);

      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/login');
      }, 2000);
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
            {t('resetPassword.title')}
          </h1>
        </div>

        {success ? (
          <div className="bg-white rounded-xl border border-[#d0d0c8] shadow-sm p-6 space-y-4">
            <div className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">
              {t('resetPassword.success')}
            </div>
            <p className="text-center text-xs text-[#888]">
              {t('resetPassword.redirecting')}
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl border border-[#d0d0c8] shadow-sm p-6 space-y-4"
          >
            <div>
              <label
                htmlFor="newPassword"
                className="block text-xs font-semibold text-[#555] mb-1"
              >
                {t('resetPassword.newPassword')}
              </label>
              <input
                id="newPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#d0d0c8] text-sm
                           focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]
                           placeholder:text-[#aaa]"
                placeholder="••••••••"
              />
              <p className="text-[10px] text-[#999] mt-1">
                {t('resetPassword.minLength')}
              </p>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold text-[#555] mb-1"
              >
                {t('resetPassword.confirmPassword')}
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#d0d0c8] text-sm
                           focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]
                           placeholder:text-[#aaa]"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 rounded-lg bg-[#c95a8a] text-white text-sm font-semibold
                         hover:bg-[#b44d7a] active:bg-[#a0426c] disabled:opacity-50
                         transition-colors cursor-pointer"
            >
              {isPending
                ? t('resetPassword.resetting')
                : t('resetPassword.submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
