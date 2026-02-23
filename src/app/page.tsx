'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { View } from '@/engine';
import { useDrawingEngine } from '@/hooks/useDrawingEngine';
import { BodyCanvas } from '@/components/canvas/BodyCanvas';
import { CanvasToolbar } from '@/components/canvas/CanvasToolbar';
import { BrushControls } from '@/components/canvas/BrushControls';
import { ViewToggle } from '@/components/canvas/ViewToggle';
import { LanguageToggle } from '@/components/ui/LanguageToggle';

/**
 * Phase 1: Assessment tool page (no auth, just the drawing interface).
 * This will later move to /patients/[studyId]/assess/page.tsx
 */
export default function AssessmentPage() {
  const {
    engine,
    calculation,
    registerCanvasRefs,
    setTool,
    setBrushRadius,
    undo,
    clearAll,
    currentTool,
    brushRadius,
  } = useDrawingEngine();

  const t = useTranslations();
  const [activeView, setActiveView] = useState<View>('anterior');

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar — results + actions */}
      <div className="sticky top-0 z-50 flex items-center justify-between px-3 py-2 bg-white border-b border-[#b0b0a8]">
        <div className="flex gap-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#c95a8a]">
              {t('tools.tbsa')}
            </span>
            <span className="font-mono text-[22px] font-medium text-[#c95a8a]">
              {calculation.tbsa.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#636e72]">
              {t('tools.dbsa')}
            </span>
            <span className="font-mono text-[22px] font-medium text-[#636e72]">
              {calculation.dbsa.toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="flex gap-1.5">
          <LanguageToggle />
          <button
            onClick={undo}
            className="px-2.5 py-1.5 rounded-md border border-[#b0b0a8] bg-white text-[#555] text-[11px] font-semibold cursor-pointer active:bg-[#ddd]"
          >
            &#x21A9; {t('actions.undo')}
          </button>
          <button
            onClick={clearAll}
            className="px-2.5 py-1.5 rounded-md border border-[#b0b0a8] bg-white text-[#555] text-[11px] font-semibold cursor-pointer active:bg-[#ddd]"
          >
            {t('actions.clear')}
          </button>
        </div>
      </div>

      {/* Main drawing area */}
      <div className="relative flex-1 flex justify-center py-2">
        {/* Side tools */}
        <div className="absolute left-2 top-12 z-20">
          <CanvasToolbar currentTool={currentTool} onToolChange={setTool} />
        </div>

        {/* View toggle */}
        <div className="absolute top-1.5 left-0 right-0 z-20 px-2">
          <ViewToggle activeView={activeView} onViewChange={setActiveView} />
        </div>

        {/* Canvas — anterior */}
        <div
          className={`w-[68vw] max-w-[320px] pt-[42px] pb-2 ${
            activeView !== 'anterior' ? 'hidden' : ''
          }`}
        >
          <BodyCanvas
            view="anterior"
            engine={engine}
            onRegister={registerCanvasRefs}
          />
        </div>

        {/* Canvas — posterior */}
        <div
          className={`w-[68vw] max-w-[320px] pt-[42px] pb-2 ${
            activeView !== 'posterior' ? 'hidden' : ''
          }`}
        >
          <BodyCanvas
            view="posterior"
            engine={engine}
            onRegister={registerCanvasRefs}
          />
        </div>
      </div>

      {/* Brush controls */}
      <BrushControls
        brushRadius={brushRadius}
        currentTool={currentTool}
        onBrushChange={setBrushRadius}
      />

      {/* Info bar */}
      <div className="px-4 py-2.5 text-[10px] text-[#555] leading-relaxed bg-white border-t border-[#b0b0a8]">
        <strong className="text-[#1a1a1a]">{t('tools.tbsa')}</strong> = {t('info.tbsa')}{' '}
        <strong className="text-[#1a1a1a]">{t('tools.dbsa')}</strong> = {t('info.dbsa')}
      </div>
    </div>
  );
}
