// Engine types for the SJS/TEN BSA Assessment Tool

export type View = 'anterior' | 'posterior';
export type Tool = 'tbsa' | 'dbsa' | 'eraser';

export interface Region {
  name: string;
  /** Lund & Browder BSA% weight for this region */
  bsaPercent: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface UndoEntry {
  view: View;
  tbsa: ImageData;
  dbsa: ImageData;
}

export interface RegionResult {
  name: string;
  /** Lund & Browder BSA% weight */
  bsaPercent: number;
  /** Fraction of region filled (0–1) */
  coverage: number;
  /** coverage * bsaPercent */
  contribution: number;
}

export interface CalculationResult {
  tbsa: number;
  dbsa: number;
  tbsaRegions: RegionResult[];
  dbsaRegions: RegionResult[];
}

export interface CanvasLayerIds {
  body: string;
  drawTbsa: string;
  drawDbsa: string;
  interact: string;
}
