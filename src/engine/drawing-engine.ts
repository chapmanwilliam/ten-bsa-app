/**
 * Drawing engine for the SJS/TEN BSA Assessment Tool.
 *
 * Extracted from prototype (sjsten-bsa-v18.html lines 140–435).
 * Framework-agnostic: operates on HTMLCanvasElement references.
 *
 * The engine manages:
 * - Brush painting (TBSA pink fill, DBSA grain pattern)
 * - Erasing (removes from both TBSA and DBSA layers)
 * - Body silhouette clipping (painting stays inside the body outline)
 * - Undo stack (up to 40 snapshots)
 * - BSA% recalculation after every stroke
 */

import { View, Tool, Point, UndoEntry, CalculationResult } from './types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, ANTERIOR_REGIONS, POSTERIOR_REGIONS } from './regions';
import { calculateRegionCoverage, sumBSA } from './calculation';
import { createGrainPattern } from './grain-pattern';

const TBSA_FILL = 'rgba(201, 90, 138, 0.42)';
const MAX_UNDO = 40;

export class DrawingEngine {
  private ctxs: Record<string, CanvasRenderingContext2D> = {};
  private cvs: Record<string, HTMLCanvasElement> = {};
  private bodyMaskCtx: Record<View, CanvasRenderingContext2D> = {} as Record<View, CanvasRenderingContext2D>;
  private grainTile: HTMLCanvasElement;
  private undoStack: UndoEntry[] = [];

  public currentTool: Tool = 'tbsa';
  public brushRadius = 12;
  public isDrawing = false;
  public lastPos: Point | null = null;

  private onCalculation?: (result: CalculationResult) => void;

  constructor() {
    this.grainTile = createGrainPattern();
  }

  /**
   * Register canvases for a given view. Call this after the canvas elements are mounted.
   */
  registerCanvases(
    view: View,
    bodyCanvas: HTMLCanvasElement,
    tbsaCanvas: HTMLCanvasElement,
    dbsaCanvas: HTMLCanvasElement,
    interactCanvas: HTMLCanvasElement,
  ): void {
    const layers = [
      { key: `body-${view}`, canvas: bodyCanvas, willRead: false },
      { key: `draw-tbsa-${view}`, canvas: tbsaCanvas, willRead: true },
      { key: `draw-dbsa-${view}`, canvas: dbsaCanvas, willRead: true },
      { key: `interact-${view}`, canvas: interactCanvas, willRead: false },
    ];

    for (const { key, canvas, willRead } of layers) {
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      this.cvs[key] = canvas;
      this.ctxs[key] = canvas.getContext('2d', { willReadFrequently: willRead })!;
    }
  }

  /**
   * Load and draw the body image and build the mask data for a view.
   */
  async loadImages(
    view: View,
    bodyImgSrc: string,
    maskImgSrc: string,
  ): Promise<void> {
    const [bodyImg, maskImg] = await Promise.all([
      this.loadImg(bodyImgSrc),
      this.loadImg(maskImgSrc),
    ]);

    // Draw body image onto the body layer
    this.ctxs[`body-${view}`].drawImage(bodyImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Build mask canvas (offscreen) for clipping and calculation
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = CANVAS_WIDTH;
    maskCanvas.height = CANVAS_HEIGHT;
    const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true })!;
    maskCtx.drawImage(maskImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.bodyMaskCtx[view] = maskCtx;
  }

  /**
   * Set a callback that fires whenever BSA percentages are recalculated.
   */
  onCalculationUpdate(cb: (result: CalculationResult) => void): void {
    this.onCalculation = cb;
  }

  /**
   * Get the canvas position from a mouse/touch event.
   */
  getPos(view: View, e: MouseEvent | TouchEvent): Point {
    const canvas = this.cvs[`interact-${view}`];
    const rect = canvas.getBoundingClientRect();
    const sx = CANVAS_WIDTH / rect.width;
    const sy = CANVAS_HEIGHT / rect.height;
    let ex: number, ey: number;

    if ('touches' in e && e.touches.length > 0) {
      ex = e.touches[0].clientX;
      ey = e.touches[0].clientY;
    } else if ('clientX' in e) {
      ex = e.clientX;
      ey = e.clientY;
    } else {
      return { x: 0, y: 0 };
    }

    return {
      x: (ex - rect.left) * sx,
      y: (ey - rect.top) * sy,
    };
  }

  /**
   * Start a brush stroke.
   */
  startStroke(view: View, pos: Point): void {
    this.isDrawing = true;
    this.saveSnap(view);
    this.lastPos = pos;
    this.doBrush(view, pos, null);
    this.applyBodyClip(view);
    this.recalc();
  }

  /**
   * Continue a brush stroke.
   */
  continueStroke(view: View, pos: Point): void {
    if (!this.isDrawing) return;
    this.doBrush(view, pos, this.lastPos);
    this.lastPos = pos;
    this.applyBodyClip(view);
    this.recalc();
  }

  /**
   * End a brush stroke.
   */
  endStroke(): void {
    this.isDrawing = false;
    this.lastPos = null;
  }

  /**
   * Undo the last stroke.
   */
  undo(): void {
    if (this.undoStack.length === 0) return;
    const snap = this.undoStack.pop()!;
    this.ctxs[`draw-tbsa-${snap.view}`].putImageData(snap.tbsa, 0, 0);
    this.ctxs[`draw-dbsa-${snap.view}`].putImageData(snap.dbsa, 0, 0);
    this.recalc();
  }

  /**
   * Clear all drawing on both views.
   */
  clearAll(): void {
    const views: View[] = ['anterior', 'posterior'];
    for (const view of views) {
      if (this.ctxs[`draw-tbsa-${view}`]) {
        this.ctxs[`draw-tbsa-${view}`].clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
      if (this.ctxs[`draw-dbsa-${view}`]) {
        this.ctxs[`draw-dbsa-${view}`].clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    }
    this.undoStack.length = 0;
    this.recalc();
  }

  /**
   * Export a canvas layer as a PNG data URL.
   */
  exportLayerAsPNG(layerId: string): string | null {
    const canvas = this.cvs[layerId];
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  }

  /**
   * Export a composite image (body + TBSA + DBSA overlaid) for a view.
   */
  exportComposite(view: View): string | null {
    const bodyCanvas = this.cvs[`body-${view}`];
    const tbsaCanvas = this.cvs[`draw-tbsa-${view}`];
    const dbsaCanvas = this.cvs[`draw-dbsa-${view}`];
    if (!bodyCanvas || !tbsaCanvas || !dbsaCanvas) return null;

    const composite = document.createElement('canvas');
    composite.width = CANVAS_WIDTH;
    composite.height = CANVAS_HEIGHT;
    const ctx = composite.getContext('2d')!;
    ctx.drawImage(bodyCanvas, 0, 0);
    ctx.drawImage(tbsaCanvas, 0, 0);
    ctx.drawImage(dbsaCanvas, 0, 0);
    return composite.toDataURL('image/png');
  }

  /**
   * Get the current calculation result.
   */
  getCalculation(): CalculationResult {
    return this.calculateAll();
  }

  // --- Private methods ---

  private loadImg(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = src;
    });
  }

  private paintDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, tool: Tool): void {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = tool === 'dbsa'
      ? ctx.createPattern(this.grainTile, 'repeat')!
      : TBSA_FILL;
    ctx.fill();
    ctx.restore();
  }

  private paintLine(
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number, x2: number, y2: number,
    r: number, tool: Tool,
  ): void {
    ctx.save();
    ctx.lineWidth = r * 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = tool === 'dbsa'
      ? ctx.createPattern(this.grainTile, 'repeat')!
      : TBSA_FILL;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  private eraseAt(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private eraseLineAt(
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number, x2: number, y2: number,
    r: number,
  ): void {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = r * 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  private applyBodyClip(view: View): void {
    const maskCtx = this.bodyMaskCtx[view];
    if (!maskCtx) return;

    for (const layer of ['draw-tbsa', 'draw-dbsa']) {
      const id = `${layer}-${view}`;
      const ctx = this.ctxs[id];
      if (!ctx) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(maskCtx.canvas, 0, 0);
      ctx.restore();
    }
  }

  private saveSnap(view: View): void {
    const tbsaCtx = this.ctxs[`draw-tbsa-${view}`];
    const dbsaCtx = this.ctxs[`draw-dbsa-${view}`];
    if (!tbsaCtx || !dbsaCtx) return;

    this.undoStack.push({
      view,
      tbsa: tbsaCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT),
      dbsa: dbsaCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT),
    });

    if (this.undoStack.length > MAX_UNDO) {
      this.undoStack.shift();
    }
  }

  private doBrush(view: View, pos: Point, prev: Point | null): void {
    const r = this.brushRadius;

    if (this.currentTool === 'eraser') {
      for (const layerKey of [`draw-tbsa-${view}`, `draw-dbsa-${view}`]) {
        const ctx = this.ctxs[layerKey];
        if (!ctx) continue;
        if (prev) {
          this.eraseLineAt(ctx, prev.x, prev.y, pos.x, pos.y, r);
        } else {
          this.eraseAt(ctx, pos.x, pos.y, r);
        }
      }
    } else {
      const id = `draw-${this.currentTool}-${view}`;
      const ctx = this.ctxs[id];
      if (!ctx) return;
      if (prev) {
        this.paintLine(ctx, prev.x, prev.y, pos.x, pos.y, r, this.currentTool);
      } else {
        this.paintDot(ctx, pos.x, pos.y, r, this.currentTool);
      }
    }
  }

  private calculateAll(): CalculationResult {
    const views: View[] = ['anterior', 'posterior'];
    const regionSets = { anterior: ANTERIOR_REGIONS, posterior: POSTERIOR_REGIONS };

    let allTbsaRegions: import('./types').RegionResult[] = [];
    let allDbsaRegions: import('./types').RegionResult[] = [];

    for (const view of views) {
      const tbsaCtx = this.ctxs[`draw-tbsa-${view}`];
      const dbsaCtx = this.ctxs[`draw-dbsa-${view}`];
      const maskCtx = this.bodyMaskCtx[view];
      if (!tbsaCtx || !dbsaCtx || !maskCtx) continue;

      const tbsaRegions = calculateRegionCoverage(
        tbsaCtx, maskCtx, regionSets[view], CANVAS_WIDTH, CANVAS_HEIGHT,
      );
      const dbsaRegions = calculateRegionCoverage(
        dbsaCtx, maskCtx, regionSets[view], CANVAS_WIDTH, CANVAS_HEIGHT,
      );

      allTbsaRegions = [...allTbsaRegions, ...tbsaRegions];
      allDbsaRegions = [...allDbsaRegions, ...dbsaRegions];
    }

    return {
      tbsa: sumBSA(allTbsaRegions),
      dbsa: sumBSA(allDbsaRegions),
      tbsaRegions: allTbsaRegions,
      dbsaRegions: allDbsaRegions,
    };
  }

  private recalc(): void {
    const result = this.calculateAll();
    this.onCalculation?.(result);
  }
}
