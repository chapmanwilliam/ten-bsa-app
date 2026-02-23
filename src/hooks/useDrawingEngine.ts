'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { DrawingEngine, View, Tool, CalculationResult } from '@/engine';

interface UseDrawingEngineReturn {
  engine: DrawingEngine | null;
  calculation: CalculationResult;
  registerCanvasRefs: (
    view: View,
    bodyRef: HTMLCanvasElement | null,
    tbsaRef: HTMLCanvasElement | null,
    dbsaRef: HTMLCanvasElement | null,
    interactRef: HTMLCanvasElement | null,
  ) => void;
  setTool: (tool: Tool) => void;
  setBrushRadius: (radius: number) => void;
  undo: () => void;
  clearAll: () => void;
  currentTool: Tool;
  brushRadius: number;
}

const EMPTY_CALCULATION: CalculationResult = {
  tbsa: 0,
  dbsa: 0,
  tbsaRegions: [],
  dbsaRegions: [],
};

export function useDrawingEngine(): UseDrawingEngineReturn {
  // Use STATE (not ref) so React re-renders when engine is created
  const [engine, setEngine] = useState<DrawingEngine | null>(null);
  const [calculation, setCalculation] = useState<CalculationResult>(EMPTY_CALCULATION);
  const [currentTool, setCurrentToolState] = useState<Tool>('tbsa');
  const [brushRadius, setBrushRadiusState] = useState(12);
  const registeredViews = useRef<Set<View>>(new Set());

  // Create engine on mount
  useEffect(() => {
    const eng = new DrawingEngine();
    eng.onCalculationUpdate(setCalculation);
    setEngine(eng);
    return () => {
      setEngine(null);
    };
  }, []);

  const registerCanvasRefs = useCallback(
    async (
      view: View,
      bodyRef: HTMLCanvasElement | null,
      tbsaRef: HTMLCanvasElement | null,
      dbsaRef: HTMLCanvasElement | null,
      interactRef: HTMLCanvasElement | null,
    ) => {
      if (!engine || !bodyRef || !tbsaRef || !dbsaRef || !interactRef) return;
      if (registeredViews.current.has(view)) return;

      registeredViews.current.add(view);
      engine.registerCanvases(view, bodyRef, tbsaRef, dbsaRef, interactRef);

      const bodyImgSrc = view === 'anterior' ? '/body-front.png' : '/body-back.png';
      const maskImgSrc = view === 'anterior' ? '/mask-front.png' : '/mask-back.png';
      await engine.loadImages(view, bodyImgSrc, maskImgSrc);
    },
    [engine],
  );

  const setTool = useCallback((tool: Tool) => {
    if (engine) {
      engine.currentTool = tool;
    }
    setCurrentToolState(tool);
  }, [engine]);

  const setBrushRadius = useCallback((radius: number) => {
    if (engine) {
      engine.brushRadius = radius;
    }
    setBrushRadiusState(radius);
  }, [engine]);

  const undo = useCallback(() => {
    engine?.undo();
  }, [engine]);

  const clearAll = useCallback(() => {
    engine?.clearAll();
  }, [engine]);

  return {
    engine,
    calculation,
    registerCanvasRefs,
    setTool,
    setBrushRadius,
    undo,
    clearAll,
    currentTool,
    brushRadius,
  };
}
