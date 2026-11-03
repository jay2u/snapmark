// Injected for full-page capture. Exposes a small API on window for the background worker.
// Self-contained on purpose: injected as a classic script, so no imports.
interface SnapmarkApi {
  measure(): { pageHeight: number; viewportWidth: number; scrollbarWidth: number; viewportHeight: number; scrollY: number };
  scrollTo(y: number): number;
  hideFixed(): void;
  restore(): void;
}

(() => {
  const w = window as unknown as { __snapmark?: SnapmarkApi };
  if (w.__snapmark) return;

  let hidden: { el: HTMLElement; vis: string; prio: string }[] = [];
  let savedBehavior: string | null = null;
  let startY = 0;

  w.__snapmark = {
    measure() {
      const de = document.documentElement, body = document.body;
      startY = window.scrollY;
      savedBehavior = de.style.scrollBehavior;
      de.style.scrollBehavior = 'auto';
      return {
        pageHeight: Math.max(de.scrollHeight, body ? body.scrollHeight : 0),
        // innerWidth includes the scrollbar, matching what captureVisibleTab renders.
        viewportWidth: window.innerWidth,
        scrollbarWidth: window.innerWidth - de.clientWidth,
        viewportHeight: window.innerHeight,
        scrollY: startY,
      };
    },
    scrollTo(y: number) {
      window.scrollTo(0, y);
      return window.scrollY;
    },
    // Fixed/sticky bars would otherwise repeat in every slice.
    hideFixed() {
      for (const el of document.querySelectorAll<HTMLElement>('body *')) {
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
      if (savedBehavior !== null) document.documentElement.style.scrollBehavior = savedBehavior;
      window.scrollTo(0, startY);
    },
  };
})();
