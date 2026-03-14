'use client';

import { useState, useRef, useEffect } from 'react';

interface InfoTooltipProps {
  text: string;
  color: string;
}

export function InfoTooltip({ text, color }: InfoTooltipProps) {
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
          className="absolute right-0 top-full mt-1 z-[100] w-52 rounded-md px-2.5 py-2 text-[11px] leading-snug text-white shadow-lg"
          style={{ backgroundColor: color }}
        >
          {text}
        </div>
      )}
    </div>
  );
}
