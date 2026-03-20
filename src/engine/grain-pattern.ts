/**
 * Creates the grainy pattern used for DBSA (detachment) drawing.
 * Transcribed from prototype (sjsten-bsa-v18.html lines 144–161).
 *
 * Returns a small canvas tile that can be used with ctx.createPattern().
 */
export function createGrainPattern(): HTMLCanvasElement {
  const size = 6;
  const pc = document.createElement('canvas');
  pc.width = size;
  pc.height = size;
  const pctx = pc.getContext('2d')!;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = Math.random();
      let r: number, g: number, b: number;
      if (s < 0.3) {
        r = 50; g = 55; b = 60;
      } else if (s < 0.6) {
        r = 90; g = 98; b = 105;
      } else {
        r = 140; g = 148; b = 155;
      }
      pctx.fillStyle = `rgb(${r},${g},${b})`;
      pctx.fillRect(x, y, 1, 1);
    }
  }

  return pc;
}
