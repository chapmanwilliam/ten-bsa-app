'use client';

import { useTranslations } from 'next-intl';
import { View } from '@/engine';

interface ViewToggleProps {
  activeView: View;
  onViewChange: (view: View) => void;
}

export function ViewToggle({ activeView, onViewChange }: ViewToggleProps) {
  const t = useTranslations('views');

  const views: { id: View; tKey: 'front' | 'back' }[] = [
    { id: 'anterior', tKey: 'front' },
    { id: 'posterior', tKey: 'back' },
  ];

  return (
    <div className="flex justify-between">
      {views.map((view) => {
        const isActive = activeView === view.id;
        return (
          <button
            key={view.id}
            onClick={() => onViewChange(view.id)}
            className={`
              px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider
              cursor-pointer border rounded-md shadow-sm transition-colors
              ${
                isActive
                  ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                  : 'bg-white text-[#555] border-[#b0b0a8]'
              }
            `}
          >
            {t(view.tKey)}
          </button>
        );
      })}
    </div>
  );
}
