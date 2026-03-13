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

export default function LocalPage() {
  const t = useTranslations();

  const {
    engine,
    calculation,
    registerCanvasRefs,
    setTool,
    setBrushRadius,
    undo,
    clearAll,
    clearView,
    currentTool,
    brushRadius,
  } = useDrawingEngine();

  const [activeView, setActiveView] = useState<View>('anterior');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadedPatientId, setLoadedPatientId] = useState('');
  const [loadMessage, setLoadMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [albumin, setAlbumin] = useState('');
  const [crp, setCrp] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-dismiss toasts
  useEffect(() => {
    if (!loadMessage) return;
    const timer = setTimeout(() => setLoadMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [loadMessage]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handleSave = useCallback(async (patientId: string, date: string) => {
    if (!engine) throw new Error('Engine not ready');

    // Stash raw layer data in localStorage for later Load
    try {
      const key = `ten-local:${patientId}:${date}`;
      const layers: Record<string, string | null> = {};
      for (const view of ['anterior', 'posterior'] as const) {
        for (const layer of ['tbsa', 'dbsa'] as const) {
          layers[`${view}-${layer}`] = engine.exportLayerAsPNG(`draw-${layer}-${view}`);
        }
      }
      // Also stash albumin + CRP values
      const stash: Record<string, any> = { layers, albumin: albumin || null, crp: crp || null };
      localStorage.setItem(key, JSON.stringify(stash));
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
          id: 'ten-local-files',
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

    // Try Web Share API on mobile only (iOS Safari, Android) — native share sheet
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const file = new File([blob], filename, { type: 'image/png' });
    if (isMobile && navigator.canShare?.({ files: [file] })) {
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
    setToastMessage(`${t('local.saveSuccess')} — ${filename}`);
  }, [engine, albumin, crp, t]);

  const processLoadedFile = useCallback(async (file: File) => {
    if (!engine) return;

    // Parse filename: "2026-03-02 TEN-001.png" → date + patientId
    const basename = file.name.replace(/\.png$/i, '');
    const spaceIdx = basename.indexOf(' ');
    if (spaceIdx < 1) {
      setLoadMessage(t('local.loadNoData'));
      return;
    }
    const date = basename.slice(0, spaceIdx);
    const patientId = basename.slice(spaceIdx + 1);

    // Look up localStorage
    const key = `ten-local:${patientId}:${date}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      setLoadMessage(t('local.loadNoData'));
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      // Support both old format (direct layers object) and new format (with albumin)
      const layers = (parsed.layers ?? parsed) as Record<string, string | null>;
      for (const view of ['anterior', 'posterior'] as const) {
        for (const layer of ['tbsa', 'dbsa'] as const) {
          const dataUrl = layers[`${view}-${layer}`];
          if (dataUrl) {
            await engine.loadLayerImage(view, layer, dataUrl);
          }
        }
      }
      // Restore albumin + CRP if present
      if (parsed.albumin) {
        setAlbumin(parsed.albumin);
      }
      if (parsed.crp) {
        setCrp(parsed.crp);
      }
      setLoadedPatientId(patientId);
      setLoadMessage(t('local.loadSuccess'));
    } catch {
      setLoadMessage(t('local.loadNoData'));
    }
  }, [engine, t]);

  const handleLoadClick = useCallback(async () => {
    // Chromium: use showOpenFilePicker so it remembers the same folder as Save
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          id: 'ten-local-files',
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
            {t('local.signIn')} →
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
            onClick={() => clearView(activeView)}
            className="px-2.5 py-1.5 rounded-md border border-[#b0b0a8] bg-white text-[#555] text-[11px] font-semibold cursor-pointer active:bg-[#ddd]"
          >
            {t('actions.clear')}
          </button>
          <button
            onClick={handleLoadClick}
            className="px-2.5 py-1.5 rounded-md border border-[#b0b0a8] bg-white text-[#555] text-[11px] font-semibold cursor-pointer active:bg-[#ddd]"
          >
            &#x1F4C2; {t('local.load')}
          </button>
          <button
            onClick={() => setSaveDialogOpen(true)}
            className="px-2.5 py-1.5 rounded-md border border-[#c95a8a] bg-[#c95a8a] text-white text-[11px] font-semibold cursor-pointer
                       hover:bg-[#b44d7a] active:bg-[#a0426c] transition-colors"
          >
            &#x1F4BE; {t('local.save')}
          </button>
        </div>
        <span className="text-[10px] text-[#999] font-medium uppercase tracking-wider">
          {t('local.badge')}
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

      {/* Albumin + CRP inputs */}
      <div className="px-4 py-3 bg-white border-t border-[#b0b0a8] space-y-2">
        <div className="flex items-center gap-2">
          <label htmlFor="albumin" className="text-[11px] font-semibold text-[#555]">
            {t('assessment.albumin')}
          </label>
          <div className="flex items-center gap-1">
            <input
              id="albumin"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              max="100"
              value={albumin}
              onChange={(e) => setAlbumin(e.target.value)}
              placeholder={t('assessment.albuminPlaceholder')}
              className="w-20 px-2 py-1.5 rounded-md border border-[#d0d0c8] text-sm text-center
                         focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]
                         placeholder:text-[#aaa]"
            />
            <span className="text-[11px] text-[#888]">{t('assessment.albuminUnit')}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="crp" className="text-[11px] font-semibold text-[#555]">
            {t('assessment.crp')}
          </label>
          <div className="flex items-center gap-1">
            <input
              id="crp"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              max="1000"
              value={crp}
              onChange={(e) => setCrp(e.target.value)}
              placeholder={t('assessment.crpPlaceholder')}
              className="w-20 px-2 py-1.5 rounded-md border border-[#d0d0c8] text-sm text-center
                         focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]
                         placeholder:text-[#aaa]"
            />
            <span className="text-[11px] text-[#888]">{t('assessment.crpUnit')}</span>
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div className="px-4 py-2.5 text-[10px] text-[#555] leading-relaxed bg-white border-t border-[#b0b0a8]">
        <strong className="text-[#1a1a1a]">{t('tools.tbsa')}</strong> ={' '}
        {t('info.tbsa')}{' '}
        <strong className="text-[#1a1a1a]">{t('tools.dbsa')}</strong> ={' '}
        {t('info.dbsa')}
      </div>

      {/* Local footer */}
      <div className="px-4 py-4 text-center">
        <p className="text-[11px] text-[#888] mb-2">
          {t('local.subtitle')}
        </p>
        <Link
          href="/login"
          className="inline-block px-5 py-2 rounded-lg bg-[#c95a8a] text-white text-xs font-semibold
                     hover:bg-[#b44d7a] active:bg-[#a0426c] transition-colors"
        >
          {t('local.signIn')}
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

      {/* Toast notifications */}
      {(loadMessage || toastMessage) && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[110] px-4 py-2 rounded-lg bg-[#1a1a1a]/85 text-white text-xs font-medium shadow-lg">
          {loadMessage || toastMessage}
        </div>
      )}

      {/* Save dialog */}
      <SaveDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        onSave={handleSave}
        defaultPatientId={loadedPatientId}
        missingFields={[
          ...(!albumin.trim() ? [t('assessment.missingAlbumin')] : []),
          ...(!crp.trim() ? [t('assessment.missingCrp')] : []),
        ]}
      />
    </div>
  );
}
