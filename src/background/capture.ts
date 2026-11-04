import { createCapture } from '../shared/db';
import { isAccessError } from '../shared/errors';
import { MAX_CAPTURE_CSS_HEIGHT, Stitcher, cropBlob, dataUrlToBlob, makeThumb, nextScrollY } from '../shared/image';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fail loudly instead of hanging forever if the page or browser never answers. */
function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error(`${what} timed out`)), ms); });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

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

/**
 * @returns 'visible-only' when the page can't be scripted (browser pages, New Tab, Web Store),
 *          in which case just the visible area was captured.
 */
export async function captureFullPage(
  tab: chrome.tabs.Tab,
  progress: (done: number, total: number) => void,
): Promise<'full' | 'visible-only'> {
  const tabId = tab.id!;
  const call = <T>(fn: (...a: any[]) => any, args: any[] = [], what = 'Page') =>
    withTimeout(runInTab<T>(tabId, fn, args), 15_000, what).then((r) => r[0]);

  let m: { pageHeight: number; viewportWidth: number; rect: { x: number; y: number; w: number; h: number } };
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['scroller.js'] });
    m = await call(() => (window as any).__snapmark.measure());
  } catch (e) {
    if (!isAccessError(e)) throw e;
    await captureVisible(tab); // can't scroll this page, but we can still grab what's on screen
    return 'visible-only';
  }
  const step = Math.max(1, m.rect.h);
  let stitcher: Stitcher | undefined;
  let total = m.pageHeight;
  let y = 0;
  let prev = -1;
  try {
    for (let i = 0; ; i++) {
      progress(i, Math.ceil(Math.min(total, MAX_CAPTURE_CSS_HEIGHT) / step));
      const actual = await call<number>((to: number) => (window as any).__snapmark.scrollTo(to), [y], 'Scrolling');
      if (i > 0 && actual <= prev) break; // the page refused to scroll further
      prev = actual;
      await sleep(120); // let lazy content and sticky headers settle
      const bitmap = await createImageBitmap(await withTimeout(grabVisible(tab.windowId), 20_000, 'Capture'));
      const pxPerCss = bitmap.width / m.viewportWidth;
      stitcher ??= new Stitcher(Math.round(m.rect.w * pxPerCss), Math.min(total, MAX_CAPTURE_CSS_HEIGHT), pxPerCss);
      stitcher.add(bitmap, m.rect, actual);
      if (i === 0) await call(() => (window as any).__snapmark.hideFixed());
      total = await call<number>(() => (window as any).__snapmark.height());
      stitcher.ensureHeight(total);
      const next = nextScrollY(actual, step, total);
      if (next === null) break;
      y = next;
    }
  } finally {
    await runInTab(tabId, () => (window as any).__snapmark.restore()).catch(() => {});
  }
  const out = await stitcher!.toBlob();
  await finish(tab, out.blob, out.width, out.height);
  return 'full';
}

async function runInTab<T = any>(tabId: number, func: (...a: any[]) => any, args: any[] = []): Promise<T[]> {
  const res = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return res.map((r) => r.result as T);
}
