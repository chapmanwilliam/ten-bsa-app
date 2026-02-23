'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLocale } from '@/i18n/actions';

export function LanguageToggle() {
  const locale = useLocale();
  const t = useTranslations('language');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const toggleLocale = () => {
    const newLocale = locale === 'en' ? 'fr' : 'en';
    startTransition(async () => {
      await setLocale(newLocale);
      router.refresh();
    });
  };

  return (
    <button
      onClick={toggleLocale}
      disabled={isPending}
      className="px-2 py-1 rounded border border-[#b0b0a8] bg-white text-[11px] font-bold text-[#555] cursor-pointer active:bg-[#ddd] disabled:opacity-50 min-w-[32px]"
      title={`Switch to ${locale === 'en' ? 'French' : 'English'}`}
    >
      {isPending ? '…' : t('toggle')}
    </button>
  );
}
