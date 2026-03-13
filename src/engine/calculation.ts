/**
 * BSA% calculation engine.
 * Transcribed from prototype calcCov function (sjsten-bsa-v18.html line 383).
 *
 * This is the clinically critical code — must produce identical results
 * to the prototype for any given canvas state.
 */

import { Region, RegionResult } from './types';

/**
 * Calculate the BSA coverage for a set of Lund & Browder regions.
 *
 * For each region, counts how many pixels within the region's bounding box:
 * - Are part of the body (mask pixel alpha > 200)
 * - Have been drawn on (draw layer pixel alpha > 25)
 *
 * Then weights the fill fraction by the region's BSA% weight.
 *
 * @param drawCtx   The 2D context of the drawing layer (TBSA or DBSA)
 * @param maskCtx   The 2D context of the body mask
 * @param regions   The Lund & Browder region definitions
 * @param canvasWidth  Canvas width (600)
 * @param canvasHeight Canvas height (1165)
 * @returns Per-region results with coverage and BSA contribution
 */
export function calculateRegionCoverage(
  drawCtx: CanvasRenderingContext2D,
  maskCtx: CanvasRenderingContext2D,
  regions: Region[],
  canvasWidth: number,
  canvasHeight: number,
): RegionResult[] {
  const drawData = drawCtx.getImageData(0, 0, canvasWidth, canvasHeight).data;
  const maskData = maskCtx.getImageData(0, 0, canvasWidth, canvasHeight).data;

  return regions.map((region) => {
    let filled = 0;
    let count = 0;

    for (let y = region.y; y < region.y + region.height && y < canvasHeight; y++) {
      for (let x = region.x; x < region.x + region.width && x < canvasWidth; x++) {
        const i = (y * canvasWidth + x) * 4;
        if (maskData[i + 3] > 200) {
          count++;
          if (drawData[i + 3] > 25) {
            filled++;
          }
        }
      }
    }

    const coverage = count > 0 ? filled / count : 0;
    return {
      name: region.name,
      bsaPercent: region.bsaPercent,
      coverage,
      contribution: coverage * region.bsaPercent,
    };
  });
}

/**
 * Sum the BSA contributions from a set of region results.
 */
export function sumBSA(results: RegionResult[]): number {
  return results.reduce((acc, r) => acc + r.contribution, 0);
}
