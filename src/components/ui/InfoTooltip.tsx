'use client';

import { useState, useRef, useEffect } from 'react';

interface InfoTooltipProps {
  text: string;
  color: string;
  position?: 'below' | 'right';
}

export function InfoTooltip({ text, color, position = 'below' }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [open]);

  const popoverClass = position === 'right'
    ? 'absolute left-full top-1/2 -translate-y-1/2 ml-2 z-[100] w-80 rounded-md px-2.5 py-2 text-[11px] leading-snug text-white shadow-lg whitespace-pre-line'
    : 'absolute right-0 top-full mt-1 z-[100] w-80 rounded-md px-2.5 py-2 text-[11px] leading-snug text-white shadow-lg whitespace-pre-line';

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="flex items-center justify-center w-[16px] h-[16px] rounded-full bg-[#3b82f6] text-white text-[10px] font-bold leading-none cursor-pointer select-none"
        aria-label="Info"
      >
        i
      </button>
      {open && (
        <div
          className={popoverClass}
          style={{ backgroundColor: color }}
        >
          {text}
        </div>
      )}
    </div>
  );
}
