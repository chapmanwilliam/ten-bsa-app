'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] px-4">
      <div className="w-full max-w-sm text-center">
        <div className="bg-white rounded-xl border border-[#d0d0c8] shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#1a1a1a]">Something went wrong</h2>
          <p className="text-xs text-[#888] break-all">{error.message}</p>
          <button
            onClick={reset}
            className="w-full py-2.5 rounded-lg bg-[#c95a8a] text-white text-sm font-semibold
                       hover:bg-[#b44d7a] active:bg-[#a0426c] transition-colors cursor-pointer"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
