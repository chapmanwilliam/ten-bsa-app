'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { View } from '@/engine';
import { useDrawingEngine } from '@/hooks/useDrawingEngine';
import { BodyCanvas } from '@/components/canvas/BodyCanvas';
import { CanvasToolbar } from '@/components/canvas/CanvasToolbar';
import { BrushControls } from '@/components/canvas/BrushControls';
import { ViewToggle } from '@/components/canvas/ViewToggle';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { SaveDialog } from '@/components/ui/SaveDialog';

export default function DemoPage() {
  const t = useTranslations();

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

  const [activeView, setActiveView] = useState<View>('anterior');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadedPatientId, setLoadedPatientId] = useState('');
  const [loadMessage, setLoadMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!loadMessage) return;
    const timer = setTimeout(() => setLoadMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [loadMessage]);

  const handleSave = useCallback(async (patientId: string, date: string) => {
    if (!engine) throw new Error('Engine not ready');

    // Stash raw layer data in localStorage for later Load
    try {
      const key = `ten-demo:${patientId}:${date}`;
      const layers: Record<string, string | null> = {};
      for (const view of ['anterior', 'posterior'] as const) {
        for (const layer of ['tbsa', 'dbsa'] as const) {
          layers[`${view}-${layer}`] = engine.exportLayerAsPNG(`draw-${layer}-${view}`);
        }
      }
      localStorage.setItem(key, JSON.stringify(layers));
    } catch {
      // localStorage full or unavailable — continue with file save
    }

    const blob = await engine.exportSummaryBlob(patientId, date);
    if (!blob) throw new Error('Export failed');

    const filename = `${date} ${patientId}.png`;

    // Try File System Access API (Chromium browsers) — "Save As" dialog
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          id: 'ten-demo-files',
          suggestedName: filename,
          types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err: any) {
        // User cancelled the picker — abort entirely
        if (err?.name === 'AbortError') throw err;
        // Any other error — fall through to download
      }
    }

    // Try Web Share API (iOS Safari, Android) — native share sheet
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
        // Share failed — fall through to anchor download
      }
    }

    // Final fallback: anchor download (desktop Firefox / desktop Safari)
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [engine]);

  const processLoadedFile = useCallback(async (file: File) => {
    if (!engine) return;

    // Parse filename: "2026-03-02 TEN-001.png" → date + patientId
    const basename = file.name.replace(/\.png$/i, '');
    const spaceIdx = basename.indexOf(' ');
    if (spaceIdx < 1) {
      setLoadMessage(t('demo.loadNoData'));
      return;
    }
    const date = basename.slice(0, spaceIdx);
    const patientId = basename.slice(spaceIdx + 1);

    // Look up localStorage
    const key = `ten-demo:${patientId}:${date}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      setLoadMessage(t('demo.loadNoData'));
      return;
    }

    try {
      const layers = JSON.parse(raw) as Record<string, string | null>;
      for (const view of ['anterior', 'posterior'] as const) {
        for (const layer of ['tbsa', 'dbsa'] as const) {
          const dataUrl = layers[`${view}-${layer}`];
          if (dataUrl) {
            await engine.loadLayerImage(view, layer, dataUrl);
          }
        }
      }
      setLoadedPatientId(patientId);
      setLoadMessage(t('demo.loadSuccess'));
    } catch {
      setLoadMessage(t('demo.loadNoData'));
    }
  }, [engine, t]);

  const handleLoadClick = useCallback(async () => {
    // Chromium: use showOpenFilePicker so it remembers the same folder as Save
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          id: 'ten-demo-files',
          types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
        });
        const file: File = await handle.getFile();
        await processLoadedFile(file);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // user cancelled
      }
    }
    // Fallback: hidden file input (Safari / Firefox)
    fileInputRef.current?.click();
  }, [processLoadedFile]);

  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so re-selecting the same file triggers onChange
    e.target.value = '';
    if (!file) return;
    await processLoadedFile(file);
  }, [processLoadedFile]);

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      {/* Top bar — TBSA/DBSA readout */}
      <div className="sticky top-0 z-50 flex items-center justify-between px-3 py-2 bg-white border-b border-[#b0b0a8]">
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="text-xs text-[#888] hover:text-[#c95a8a] transition-colors"
          >
            {t('demo.signIn')} →
          </Link>
        </div>
        <div className="flex gap-3">
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
      </div>

      {/* Tool bar */}
      <div className="sticky top-[41px] z-50 flex items-center justify-between px-3 py-1.5 bg-[#f8f8f5] border-b border-[#d0d0c8]">
        <div className="flex gap-1.5 items-center">
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
          <button
            onClick={handleLoadClick}
            className="px-2.5 py-1.5 rounded-md border border-[#b0b0a8] bg-white text-[#555] text-[11px] font-semibold cursor-pointer active:bg-[#ddd]"
          >
            &#x1F4C2; {t('demo.load')}
          </button>
          <button
            onClick={() => setSaveDialogOpen(true)}
            className="px-2.5 py-1.5 rounded-md border border-[#c95a8a] bg-[#c95a8a] text-white text-[11px] font-semibold cursor-pointer
                       hover:bg-[#b44d7a] active:bg-[#a0426c] transition-colors"
          >
            &#x1F4BE; {t('demo.save')}
          </button>
        </div>
        <span className="text-[10px] text-[#999] font-medium uppercase tracking-wider">
          {t('demo.badge')}
        </span>
      </div>

      {/* Main drawing area */}
      <div className="relative flex justify-center py-2">
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
        <strong className="text-[#1a1a1a]">{t('tools.tbsa')}</strong> ={' '}
        {t('info.tbsa')}{' '}
        <strong className="text-[#1a1a1a]">{t('tools.dbsa')}</strong> ={' '}
        {t('info.dbsa')}
      </div>

      {/* Demo footer */}
      <div className="px-4 py-4 text-center">
        <p className="text-[11px] text-[#888] mb-2">
          {t('demo.subtitle')}
        </p>
        <Link
          href="/login"
          className="inline-block px-5 py-2 rounded-lg bg-[#c95a8a] text-white text-xs font-semibold
                     hover:bg-[#b44d7a] active:bg-[#a0426c] transition-colors"
        >
          {t('demo.signIn')}
        </Link>
      </div>

      {/* Hidden file input for Load */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".png"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Toast notification */}
      {loadMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[110] px-4 py-2 rounded-lg bg-[#1a1a1a]/85 text-white text-xs font-medium shadow-lg">
          {loadMessage}
        </div>
      )}

      {/* Save dialog */}
      <SaveDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        onSave={handleSave}
        defaultPatientId={loadedPatientId}
      />
    </div>
  );
}
