// Injected for full-page capture. Exposes a small API on window for the background worker.
// Self-contained on purpose: injected as a classic script, so no imports.
interface Box { x: number; y: number; w: number; h: number }
interface SnapmarkApi {
  measure(): { pageHeight: number; viewportWidth: number; rect: Box; scrollY: number; inner: boolean };
  scrollTo(y: number): Promise<number>;
  height(): number;
  hideFixed(): void;
  restore(): void;
}

(() => {
  const w = window as unknown as { __snapmark?: SnapmarkApi };
  // Always replace: the page may have changed since the last capture.
  const de = document.documentElement;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /** The element being scrolled, or null when the document itself scrolls. */
  let target: HTMLElement | null = null;
  let startY = 0;
  let hidden: { el: HTMLElement; vis: string; prio: string }[] = [];

  const docHeight = () => Math.max(de.scrollHeight, document.body ? document.body.scrollHeight : 0);

  function documentScrolls(): boolean {
    if (docHeight() - window.innerHeight < 20) return false;
    // Probe: overflow:hidden on <html>/<body> makes the document tall but not scrollable.
    const y0 = window.scrollY;
    window.scrollTo({ top: y0 > 0 ? y0 - 1 : 1, behavior: 'instant' });
    const moved = window.scrollY !== y0;
    window.scrollTo({ top: y0, behavior: 'instant' });
    return moved;
  }

  /** Largest visible element that scrolls vertically (web apps often scroll inside a pane). */
  function findScroller(): HTMLElement | null {
    const vw = window.innerWidth, vh = window.innerHeight;
    let best: HTMLElement | null = null;
    let bestScore = 0;
    for (const el of document.querySelectorAll<HTMLElement>('*')) {
      if (el.scrollHeight - el.clientHeight < 20) continue;
      const oy = getComputedStyle(el).overflowY;
      if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') continue;
      const r = el.getBoundingClientRect();
      const area = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (area < vw * vh * 0.2) continue;
      const score = area * (el.scrollHeight - el.clientHeight);
      if (score > bestScore) { best = el; bestScore = score; }
    }
    return best;
  }

  w.__snapmark = {
    measure() {
      target = documentScrolls() ? null : findScroller();
      if (!target) {
        startY = window.scrollY;
        return {
          pageHeight: docHeight(),
          viewportWidth: window.innerWidth, // includes the scrollbar, like captureVisibleTab
          rect: { x: 0, y: 0, w: de.clientWidth, h: window.innerHeight },
          scrollY: startY,
          inner: false,
        };
      }
      startY = target.scrollTop;
      const r = target.getBoundingClientRect();
      const x = Math.max(0, r.left + target.clientLeft), y = Math.max(0, r.top + target.clientTop);
      const x2 = Math.min(window.innerWidth, r.left + target.clientLeft + target.clientWidth);
      const y2 = Math.min(window.innerHeight, r.top + target.clientTop + target.clientHeight);
      return {
        pageHeight: target.scrollHeight,
        viewportWidth: window.innerWidth,
        rect: { x, y, w: x2 - x, h: y2 - y },
        scrollY: startY,
        inner: true,
      };
    },
    async scrollTo(y: number) {
      // 'instant' ignores CSS scroll-behavior: smooth, which would otherwise leave us mid-scroll.
      if (target) target.scrollTo({ top: y, behavior: 'instant' });
      else window.scrollTo({ top: y, behavior: 'instant' });
      await sleep(60);
      return target ? target.scrollTop : window.scrollY;
    },
    height() {
      return target ? target.scrollHeight : docHeight();
    },
    // Fixed/sticky bars would otherwise repeat in every slice.
    hideFixed() {
      for (const el of document.querySelectorAll<HTMLElement>('body *')) {
        // Never hide something that contains the scrolling pane (e.g. a fixed app shell).
        if (el === target || (target && el.contains(target))) continue;
        const pos = getComputedStyle(el).position;
        if (pos === 'fixed' || pos === 'sticky') {
          hidden.push({ el, vis: el.style.getPropertyValue('visibility'), prio: el.style.getPropertyPriority('visibility') });
          el.style.setProperty('visibility', 'hidden', 'important');
        }
      }
    },
    restore() {
      for (const h of hidden) {
        if (h.vis) h.el.style.setProperty('visibility', h.vis, h.prio);
        else h.el.style.removeProperty('visibility');
      }
      hidden = [];
      if (target) target.scrollTo({ top: startY, behavior: 'instant' });
      else window.scrollTo({ top: startY, behavior: 'instant' });
    },
  };
})();
