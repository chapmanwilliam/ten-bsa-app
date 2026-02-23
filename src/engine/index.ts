export { DrawingEngine } from './drawing-engine';
export { calculateRegionCoverage, sumBSA } from './calculation';
export { ANTERIOR_REGIONS, POSTERIOR_REGIONS, CANVAS_WIDTH, CANVAS_HEIGHT } from './regions';
export { createGrainPattern } from './grain-pattern';
export type {
  View,
  Tool,
  Point,
  Region,
  RegionResult,
  CalculationResult,
  UndoEntry,
  CanvasLayerIds,
} from './types';
