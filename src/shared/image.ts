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

export interface Slice {
  bitmap: ImageBitmap;
  /** Page scroll offset (CSS px) at which this slice was taken. */
  scrollY: number;
}

// Browsers cap canvas size; stay safely below Chrome's limits.
export const MAX_CANVAS_DIM = 32000;
export const MAX_CANVAS_AREA = 250_000_000;

/** Scale factor (<= 1) needed so a w x h canvas stays within browser limits. */
export function limitScale(w: number, h: number): number {
  return Math.min(1, MAX_CANVAS_DIM / w, MAX_CANVAS_DIM / h, Math.sqrt(MAX_CANVAS_AREA / (w * h)));
}

/**
 * Stitch viewport slices into one tall image.
 * @param pxPerCss device pixels per CSS pixel (slice.width / viewport width)
 * @param pageHeight total page height in CSS px
 * @param cropRight device pixels to trim from the right of each slice (the scrollbar)
 */
export async function stitchSlices(slices: Slice[], pxPerCss: number, pageHeight: number, cropRight = 0) {
  const fullW = slices[0].bitmap.width - cropRight;
  const fullH = Math.round(pageHeight * pxPerCss);
  const k = limitScale(fullW, fullH);
  const c = new OffscreenCanvas(Math.max(1, Math.round(fullW * k)), Math.max(1, Math.round(fullH * k)));
  const ctx = c.getContext('2d')!;
  for (const s of slices) {
    const dy = Math.round(s.scrollY * pxPerCss * k);
    ctx.drawImage(s.bitmap, 0, 0, fullW, s.bitmap.height, 0, dy, Math.round(fullW * k), Math.round(s.bitmap.height * k));
  }
  return { blob: await c.convertToBlob({ type: 'image/png' }), width: c.width, height: c.height };
}

/** Scroll offsets (CSS px) needed to cover a page; the last one is clamped to the page end. */
export function scrollPositions(pageHeight: number, viewportHeight: number): number[] {
  const max = Math.max(0, pageHeight - viewportHeight);
  const ys: number[] = [];
  for (let y = 0; y < max; y += viewportHeight) ys.push(y);
  ys.push(max);
  return ys;
}
