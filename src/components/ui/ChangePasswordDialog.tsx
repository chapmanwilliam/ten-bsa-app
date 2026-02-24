'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { changePassword } from '@/app/auth/actions';

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  const t = useTranslations();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function reset() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setMessage(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: t('changePassword.tooShort') });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: t('changePassword.mismatch') });
      return;
    }

    startTransition(async () => {
      const result = await changePassword(currentPassword, newPassword);

      if (result.error) {
        setMessage({ type: 'error', text: t('changePassword.error') });
      } else {
        setMessage({ type: 'success', text: t('changePassword.success') });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => handleClose(), 1500);
      }
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl border border-[#d0d0c8] shadow-lg w-full max-w-sm p-6">
        <h3 className="text-base font-semibold mb-4">
          {t('changePassword.title')}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#555] mb-1">
              {t('changePassword.currentPassword')}
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#d0d0c8] text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#555] mb-1">
              {t('changePassword.newPassword')}
            </label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#d0d0c8] text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#555] mb-1">
              {t('changePassword.confirmPassword')}
            </label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#d0d0c8] text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]"
            />
          </div>

          {message && (
            <div
              className={`text-xs rounded-lg px-3 py-2 ${
                message.type === 'success'
                  ? 'text-green-700 bg-green-50'
                  : 'text-red-600 bg-red-50'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2 text-sm rounded-lg border border-[#d0d0c8] hover:bg-[#f0f0ea] transition-colors"
            >
              {t('changePassword.cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2 text-sm font-semibold rounded-lg bg-[#c95a8a] text-white
                         hover:bg-[#b44d7a] disabled:opacity-50 transition-colors"
            >
              {isPending
                ? t('changePassword.submitting')
                : t('changePassword.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
