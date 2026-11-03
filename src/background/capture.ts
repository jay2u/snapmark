import { createCapture } from '../shared/db';
import { cropBlob, dataUrlToBlob, makeThumb, scrollPositions, stitchSlices, type Slice } from '../shared/image';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Chrome allows ~2 captureVisibleTab calls per second.
const CAPTURE_GAP_MS = 600;
let lastCapture = 0;

export async function grabVisible(windowId: number): Promise<Blob> {
  for (let attempt = 0; ; attempt++) {
    const wait = lastCapture + CAPTURE_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      lastCapture = Date.now();
      const url = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
      return await dataUrlToBlob(url);
    } catch (e) {
      if (attempt < 3 && String(e).includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND')) {
        await sleep(1000);
        continue;
      }
      throw e;
    }
  }
}

async function finish(tab: chrome.tabs.Tab, blob: Blob, width: number, height: number) {
  const id = await createCapture(blob, {
    title: tab.title || 'Screenshot',
    url: tab.url || '',
    width,
    height,
    thumb: await makeThumb(blob),
  });
  await openEditor(id, tab);
}

export async function openEditor(id: string, nearTab?: chrome.tabs.Tab) {
  await chrome.tabs.create({
    url: chrome.runtime.getURL(`src/editor/editor.html?id=${id}`),
    index: nearTab ? nearTab.index + 1 : undefined,
    openerTabId: nearTab?.id,
  });
}

export async function captureVisible(tab: chrome.tabs.Tab) {
  const blob = await grabVisible(tab.windowId);
  const bmp = await createImageBitmap(blob);
  await finish(tab, blob, bmp.width, bmp.height);
}

export async function captureRegion(tab: chrome.tabs.Tab, rect: { x: number; y: number; w: number; h: number }) {
  await sleep(120); // let the selection overlay disappear from the next frame
  const blob = await grabVisible(tab.windowId);
  const bmp = await createImageBitmap(blob);
  const [vw] = await runInTab<number>(tab.id!, () => window.innerWidth);
  // Screenshot pixels per CSS pixel (includes devicePixelRatio and page zoom).
  const k = bmp.width / Math.max(vw, 1);
  const out = await cropBlob(blob, { x: rect.x * k, y: rect.y * k, w: rect.w * k, h: rect.h * k });
  await finish(tab, out.blob, out.width, out.height);
}

export async function captureFullPage(tab: chrome.tabs.Tab, progress: (done: number, total: number) => void) {
  const tabId = tab.id!;
  await chrome.scripting.executeScript({ target: { tabId }, files: ['scroller.js'] });
  const [m] = await runInTab(tabId, () => (window as any).__snapmark.measure());
  const ys = scrollPositions(m.pageHeight, m.viewportHeight);
  const slices: Slice[] = [];
  let pxPerCss = 1;
  try {
    for (let i = 0; i < ys.length; i++) {
      progress(i, ys.length);
      const [actual] = await runInTab<number>(tabId, (y: number) => (window as any).__snapmark.scrollTo(y), [ys[i]]);
      await sleep(150); // allow lazy content and sticky headers to settle
      const bitmap = await createImageBitmap(await grabVisible(tab.windowId));
      pxPerCss = bitmap.width / m.viewportWidth;
      slices.push({ bitmap, scrollY: actual });
      if (i === 0 && ys.length > 1) await runInTab(tabId, () => (window as any).__snapmark.hideFixed());
    }
  } finally {
    await runInTab(tabId, () => (window as any).__snapmark.restore()).catch(() => {});
  }
  const out = await stitchSlices(slices, pxPerCss, m.pageHeight, Math.round(m.scrollbarWidth * pxPerCss));
  await finish(tab, out.blob, out.width, out.height);
}

async function runInTab<T = any>(tabId: number, func: (...a: any[]) => any, args: any[] = []): Promise<T[]> {
  const res = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return res.map((r) => r.result as T);
}
