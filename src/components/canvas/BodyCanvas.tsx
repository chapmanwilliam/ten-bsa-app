'use client';

import { useRef, useEffect } from 'react';
import { DrawingEngine, View } from '@/engine';

interface BodyCanvasProps {
  view: View;
  engine: DrawingEngine | null;
  onRegister: (
    view: View,
    body: HTMLCanvasElement | null,
    tbsa: HTMLCanvasElement | null,
    dbsa: HTMLCanvasElement | null,
    interact: HTMLCanvasElement | null,
  ) => void;
}

/**
 * Renders the 4-layer canvas stack for a body view (anterior or posterior).
 *
 * Layers (bottom to top):
 * 1. body    — the anatomical outline image
 * 2. tbsa    — TBSA drawing layer (pink)
 * 3. dbsa    — DBSA drawing layer (grey grain)
 * 4. interact — transparent interaction layer (captures pointer events)
 */
export function BodyCanvas({ view, engine, onRegister }: BodyCanvasProps) {
  const bodyRef = useRef<HTMLCanvasElement>(null);
  const tbsaRef = useRef<HTMLCanvasElement>(null);
  const dbsaRef = useRef<HTMLCanvasElement>(null);
  const interactRef = useRef<HTMLCanvasElement>(null);

  // Register canvases with the engine once both are available
  useEffect(() => {
    if (!engine) return;
    onRegister(
      view,
      bodyRef.current,
      tbsaRef.current,
      dbsaRef.current,
      interactRef.current,
    );
  }, [view, engine, onRegister]);

  // Attach pointer/touch event handlers
  useEffect(() => {
    const canvas = interactRef.current;
    if (!canvas || !engine) return;

    const onStart = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const pos = engine.getPos(view, e);
      engine.startStroke(view, pos);
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!engine.isDrawing) return;
      e.preventDefault();
      const pos = engine.getPos(view, e);
      engine.continueStroke(view, pos);
    };

    const onEnd = () => {
      engine.endStroke();
    };

    canvas.addEventListener('mousedown', onStart);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onEnd);
    canvas.addEventListener('mouseleave', onEnd);
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd);
    canvas.addEventListener('touchcancel', onEnd);

    return () => {
      canvas.removeEventListener('mousedown', onStart);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', onEnd);
      canvas.removeEventListener('mouseleave', onEnd);
      canvas.removeEventListener('touchstart', onStart);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onEnd);
      canvas.removeEventListener('touchcancel', onEnd);
    };
  }, [engine, view]);

  return (
    <div
      className="relative bg-[#c8c8c0] touch-none"
      style={{ aspectRatio: '600 / 1165' }}
    >
      <canvas ref={bodyRef} className="absolute inset-0 w-full h-full" />
      <canvas ref={tbsaRef} className="absolute inset-0 w-full h-full" />
      <canvas ref={dbsaRef} className="absolute inset-0 w-full h-full" />
      <canvas ref={interactRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
