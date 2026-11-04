/** Helpers that work in both the service worker and extension pages. */

export const THUMB_WIDTH = 360;

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

export async function makeThumb(source: Blob | ImageBitmap, width = THUMB_WIDTH): Promise<Blob> {
  const bmp = source instanceof Blob ? await createImageBitmap(source) : source;
  const scale = Math.min(1, width / bmp.width);
  const c = new OffscreenCanvas(Math.max(1, Math.round(bmp.width * scale)), Math.max(1, Math.round(bmp.height * scale)));
  const ctx = c.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
}

export async function cropBlob(
  blob: Blob,
  rect: { x: number; y: number; w: number; h: number },
): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(blob);
  const x = Math.max(0, Math.min(bmp.width - 1, Math.round(rect.x)));
  const y = Math.max(0, Math.min(bmp.height - 1, Math.round(rect.y)));
  const w = Math.max(1, Math.min(bmp.width - x, Math.round(rect.w)));
  const h = Math.max(1, Math.min(bmp.height - y, Math.round(rect.h)));
  const c = new OffscreenCanvas(w, h);
  c.getContext('2d')!.drawImage(bmp, x, y, w, h, 0, 0, w, h);
  return { blob: await c.convertToBlob({ type: 'image/png' }), width: w, height: h };
}

// Browsers cap canvas size; stay safely below Chrome's limits (and keep memory sane: 4 bytes/pixel).
export const MAX_CANVAS_DIM = 32000;
export const MAX_CANVAS_AREA = 120_000_000;
/** Stop full-page capture after this many CSS pixels of page height (infinite-scroll pages). */
export const MAX_CAPTURE_CSS_HEIGHT = 30_000;

/** Scale factor (<= 1) needed so a w x h canvas stays within browser limits. */
export function limitScale(w: number, h: number): number {
  return Math.min(1, MAX_CANVAS_DIM / w, MAX_CANVAS_DIM / h, Math.sqrt(MAX_CANVAS_AREA / (w * h)));
}

/**
 * Where to scroll for the next slice, or null when the page is covered.
 * @param actual scroll position the last slice was taken at
 * @param step visible height of one slice
 * @param total current scrollable height
 */
export function nextScrollY(actual: number, step: number, total: number, cap = MAX_CAPTURE_CSS_HEIGHT): number | null {
  const next = actual + step;
  if (next >= total || next >= cap) return null; // the slice at `actual` already reaches the end
  return Math.min(next, total - step); // the final slice is clamped to the page end
}

/**
 * Builds one tall image from viewport slices, drawing each straight onto the canvas so only
 * the result (not every slice) is held in memory.
 */
export class Stitcher {
  private canvas: OffscreenCanvas;
  readonly k: number; // output pixels per captured pixel (< 1 only for huge pages)
  private heightCss = 0;

  constructor(private widthPx: number, heightCss: number, private pxPerCss: number) {
    this.k = limitScale(widthPx, Math.max(1, heightCss * pxPerCss));
    this.canvas = new OffscreenCanvas(Math.max(1, Math.round(widthPx * this.k)), 1);
    this.ensureHeight(heightCss);
  }

  get width() { return this.canvas.width; }
  get height() { return this.canvas.height; }

  /** Grow the canvas when the page got taller while capturing (lazy content). */
  ensureHeight(heightCss: number) {
    heightCss = Math.min(heightCss, MAX_CAPTURE_CSS_HEIGHT);
    const maxH = Math.floor(Math.min(MAX_CANVAS_DIM, MAX_CANVAS_AREA / this.canvas.width));
    const want = Math.min(maxH, Math.max(1, Math.round(heightCss * this.pxPerCss * this.k)));
    if (want <= this.canvas.height && this.heightCss) return;
    this.heightCss = heightCss;
    if (want === this.canvas.height) return;
    const next = new OffscreenCanvas(this.canvas.width, want);
    next.getContext('2d')!.drawImage(this.canvas, 0, 0);
    this.canvas = next;
  }

  /** Draw the `rect` part (CSS px, viewport coordinates) of a captured bitmap at page offset scrollY. */
  add(bitmap: ImageBitmap, rect: { x: number; y: number; w: number; h: number }, scrollY: number) {
    const p = this.pxPerCss;
    const sx = Math.round(rect.x * p), sy = Math.round(rect.y * p);
    const sw = Math.min(bitmap.width - sx, Math.round(rect.w * p)), sh = Math.min(bitmap.height - sy, Math.round(rect.h * p));
    const dy = Math.round(scrollY * p * this.k);
    this.canvas.getContext('2d')!.drawImage(
      bitmap, sx, sy, sw, sh,
      0, dy, Math.round(sw * this.k), Math.ceil(sh * this.k) + 1, // +1px overlap hides rounding seams
    );
    bitmap.close();
  }

  async toBlob() {
    return { blob: await this.canvas.convertToBlob({ type: 'image/png' }), width: this.canvas.width, height: this.canvas.height };
  }
}
