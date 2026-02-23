/**
 * Lund & Browder region definitions for BSA% calculation.
 * Transcribed directly from prototype (sjsten-bsa-v18.html lines 343–381).
 *
 * Each region defines a bounding rectangle on the 600×1165 canvas
 * and its BSA% weight according to the Lund & Browder chart.
 */

import { Region } from './types';

/** Canvas internal dimensions (must match the body/mask images) */
export const CANVAS_WIDTH = 600;
export const CANVAS_HEIGHT = 1165;

/** Anterior (front) body regions */
export const ANTERIOR_REGIONS: Region[] = [
  { name: 'Head',       bsaPercent: 3.5,  x: 225, y: 0,   width: 150, height: 130 },
  { name: 'Neck',       bsaPercent: 1.0,  x: 265, y: 128, width: 70,  height: 40 },
  { name: 'R Ant Trunk', bsaPercent: 6.5, x: 175, y: 168, width: 125, height: 255 },
  { name: 'L Ant Trunk', bsaPercent: 6.5, x: 300, y: 168, width: 125, height: 255 },
  { name: 'Genitalia',  bsaPercent: 1.0,  x: 260, y: 425, width: 80,  height: 55 },
  { name: 'R UArm',     bsaPercent: 2.0,  x: 90,  y: 185, width: 82,  height: 155 },
  { name: 'L UArm',     bsaPercent: 2.0,  x: 428, y: 185, width: 82,  height: 155 },
  { name: 'R FArm',     bsaPercent: 1.5,  x: 42,  y: 342, width: 70,  height: 170 },
  { name: 'L FArm',     bsaPercent: 1.5,  x: 488, y: 342, width: 70,  height: 170 },
  { name: 'R Hand',     bsaPercent: 1.25, x: 0,   y: 512, width: 65,  height: 120 },
  { name: 'L Hand',     bsaPercent: 1.25, x: 535, y: 512, width: 65,  height: 120 },
  { name: 'R Thigh',    bsaPercent: 4.75, x: 195, y: 480, width: 78,  height: 225 },
  { name: 'L Thigh',    bsaPercent: 4.75, x: 327, y: 480, width: 78,  height: 225 },
  { name: 'R LLeg',     bsaPercent: 3.5,  x: 195, y: 708, width: 72,  height: 240 },
  { name: 'L LLeg',     bsaPercent: 3.5,  x: 333, y: 708, width: 72,  height: 240 },
  { name: 'R Foot',     bsaPercent: 1.75, x: 170, y: 950, width: 100, height: 215 },
  { name: 'L Foot',     bsaPercent: 1.75, x: 330, y: 950, width: 100, height: 215 },
];

/** Posterior (back) body regions */
export const POSTERIOR_REGIONS: Region[] = [
  { name: 'Head',        bsaPercent: 3.5,  x: 225, y: 0,   width: 150, height: 130 },
  { name: 'Neck',        bsaPercent: 1.0,  x: 265, y: 128, width: 70,  height: 40 },
  { name: 'R Post Trunk', bsaPercent: 6.5, x: 175, y: 168, width: 125, height: 240 },
  { name: 'L Post Trunk', bsaPercent: 6.5, x: 300, y: 168, width: 125, height: 240 },
  { name: 'R Buttock',   bsaPercent: 2.5,  x: 175, y: 410, width: 125, height: 80 },
  { name: 'L Buttock',   bsaPercent: 2.5,  x: 300, y: 410, width: 125, height: 80 },
  { name: 'R UArm',      bsaPercent: 2.0,  x: 90,  y: 185, width: 82,  height: 155 },
  { name: 'L UArm',      bsaPercent: 2.0,  x: 428, y: 185, width: 82,  height: 155 },
  { name: 'R FArm',      bsaPercent: 1.5,  x: 42,  y: 342, width: 70,  height: 170 },
  { name: 'L FArm',      bsaPercent: 1.5,  x: 488, y: 342, width: 70,  height: 170 },
  { name: 'R Hand',      bsaPercent: 1.25, x: 0,   y: 512, width: 65,  height: 120 },
  { name: 'L Hand',      bsaPercent: 1.25, x: 535, y: 512, width: 65,  height: 120 },
  { name: 'R Thigh',     bsaPercent: 4.75, x: 195, y: 490, width: 78,  height: 220 },
  { name: 'L Thigh',     bsaPercent: 4.75, x: 327, y: 490, width: 78,  height: 220 },
  { name: 'R LLeg',      bsaPercent: 3.5,  x: 195, y: 708, width: 72,  height: 240 },
  { name: 'L LLeg',      bsaPercent: 3.5,  x: 333, y: 708, width: 72,  height: 240 },
  { name: 'R Foot',      bsaPercent: 1.75, x: 170, y: 950, width: 100, height: 215 },
  { name: 'L Foot',      bsaPercent: 1.75, x: 330, y: 950, width: 100, height: 215 },
];
