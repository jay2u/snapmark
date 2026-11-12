// Injected on demand. Lets the user drag a rectangle over the page, adjust it (move, resize, nudge),
// then confirm with Enter / the Capture button. Self-contained on purpose: injected as a classic
// script, so no imports.
(() => {
  const w = window as unknown as { __snapmarkSelecting?: boolean };
  if (w.__snapmarkSelecting) return;
  w.__snapmarkSelecting = true;

  type Rc = { x: number; y: number; w: number; h: number };
  const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
  type Handle = (typeof HANDLES)[number];
  const CURSOR: Record<Handle, string> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;user-select:none;';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>
      .dim { position:fixed; background:rgba(0,0,0,.55); pointer-events:none; }
      .box { position:fixed; border:2px solid #4f8cff; box-sizing:border-box; display:none; }
      .h { position:fixed; width:10px; height:10px; margin:-5px 0 0 -5px; background:#fff; border:2px solid #4f8cff;
           box-sizing:border-box; border-radius:2px; display:none; }
      .tag { position:fixed; background:#1f2937; color:#fff; font:12px/1 system-ui,sans-serif;
             padding:4px 6px; border-radius:4px; display:none; pointer-events:none; }
      .bar { position:fixed; display:none; gap:6px; background:#1f2937; padding:5px; border-radius:8px;
             font:13px system-ui,sans-serif; box-shadow:0 4px 16px rgba(0,0,0,.4); cursor:default; }
      .bar button { font:inherit; border:0; border-radius:5px; padding:5px 12px; cursor:pointer; color:#fff; background:#374151; }
      .bar button.go { background:#2563eb; }
      .bar kbd { opacity:.65; font:11px ui-monospace,monospace; margin-left:6px; }
      .hint { position:fixed; top:12px; left:50%; transform:translateX(-50%); background:#1f2937; color:#fff;
              font:13px system-ui,sans-serif; padding:8px 14px; border-radius:8px; pointer-events:none; white-space:nowrap; }
    </style>
    <div class="dim" id="full" style="inset:0"></div>
    <div class="dim" id="t"></div><div class="dim" id="b"></div>
    <div class="dim" id="l"></div><div class="dim" id="r"></div>
    <div class="box" id="box"></div>
    ${HANDLES.map((h) => `<div class="h" data-h="${h}" style="cursor:${CURSOR[h]}"></div>`).join('')}
    <div class="tag" id="tag"></div>
    <div class="bar" id="bar"><button id="cancel">Cancel<kbd>Esc</kbd></button><button class="go" id="go">Capture<kbd>Enter</kbd></button></div>
    <div class="hint" id="hint">Drag to select an area &middot; Esc to cancel</div>`;
  const $ = (id: string) => shadow.getElementById(id) as HTMLElement;
  const [full, t, b, l, r, box, tag, hint, bar] = ['full', 't', 'b', 'l', 'r', 'box', 'tag', 'hint', 'bar'].map($);
  const handleEls = Array.from(shadow.querySelectorAll<HTMLElement>('.h'));
  [t, b, l, r].forEach((e) => (e.style.display = 'none'));

  const vw = () => document.documentElement.clientWidth;
  const vh = () => document.documentElement.clientHeight;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  let rect: Rc = { x: 0, y: 0, w: 0, h: 0 };
  let adjusting = false;
  type Action = { kind: 'draw'; sx: number; sy: number } | { kind: 'move'; px: number; py: number; orig: Rc } | { kind: 'resize'; handle: Handle; orig: Rc };
  let action: Action | null = null;

  function redraw() {
    const rc = rect;
    full.style.display = 'none';
    [t, b, l, r].forEach((e) => (e.style.display = 'block'));
    Object.assign(t.style, { left: '0', top: '0', width: '100vw', height: rc.y + 'px' });
    Object.assign(b.style, { left: '0', top: rc.y + rc.h + 'px', width: '100vw', height: vh() - rc.y - rc.h + 'px' });
    Object.assign(l.style, { left: '0', top: rc.y + 'px', width: rc.x + 'px', height: rc.h + 'px' });
    Object.assign(r.style, { left: rc.x + rc.w + 'px', top: rc.y + 'px', width: vw() - rc.x - rc.w + 'px', height: rc.h + 'px' });
    Object.assign(box.style, { display: 'block', left: rc.x + 'px', top: rc.y + 'px', width: rc.w + 'px', height: rc.h + 'px', cursor: adjusting ? 'move' : 'crosshair' });
    tag.textContent = `${Math.round(rc.w)} × ${Math.round(rc.h)}`;
    Object.assign(tag.style, { display: 'block', left: rc.x + 'px', top: Math.max(0, rc.y - 24) + 'px' });
    const cx = rc.x + rc.w / 2, cy = rc.y + rc.h / 2;
    const pos: Record<Handle, [number, number]> = {
      nw: [rc.x, rc.y], n: [cx, rc.y], ne: [rc.x + rc.w, rc.y], e: [rc.x + rc.w, cy],
      se: [rc.x + rc.w, rc.y + rc.h], s: [cx, rc.y + rc.h], sw: [rc.x, rc.y + rc.h], w: [rc.x, cy],
    };
    for (const el of handleEls) {
      const [hx, hy] = pos[el.dataset.h as Handle];
      Object.assign(el.style, { display: adjusting ? 'block' : 'none', left: hx + 'px', top: hy + 'px' });
    }
    if (adjusting) {
      bar.style.display = 'flex';
      const bw = bar.offsetWidth || 190, bh = bar.offsetHeight || 36;
      const below = rc.y + rc.h + 10 + bh <= vh();
      Object.assign(bar.style, {
        left: clamp(rc.x + rc.w - bw, 4, Math.max(4, vw() - bw - 4)) + 'px',
        top: (below ? rc.y + rc.h + 10 : Math.max(4, rc.y - bh - 10 - (rc.y >= 28 ? 24 : 0))) + 'px',
      });
    } else bar.style.display = 'none';
  }

  function cleanup() {
    host.remove();
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('mousemove', onMove, true);
    window.removeEventListener('mouseup', onUp, true);
    w.__snapmarkSelecting = false;
  }
  function cancel() {
    cleanup();
    chrome.runtime.sendMessage({ type: 'region-cancelled' });
  }
  function confirm() {
    const rc = { ...rect };
    cleanup(); // remove the overlay first so it isn't in the screenshot
    if (rc.w < 4 || rc.h < 4) chrome.runtime.sendMessage({ type: 'region-cancelled' });
    else chrome.runtime.sendMessage({ type: 'region-selected', rect: rc });
  }
  function onKey(e: KeyboardEvent) {
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.key === 'Escape') { stop(); cancel(); return; }
    if (!adjusting) return;
    if (e.key === 'Enter') { stop(); confirm(); return; }
    const step = e.shiftKey ? 10 : 1;
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (d[e.key]) {
      stop();
      rect = { ...rect, x: clamp(rect.x + d[e.key][0], 0, vw() - rect.w), y: clamp(rect.y + d[e.key][1], 0, vh() - rect.h) };
      redraw();
    }
  }

  const between = (ax: number, ay: number, bx: number, by: number): Rc => {
    const left = clamp(Math.min(ax, bx), 0, vw()), top = clamp(Math.min(ay, by), 0, vh());
    const right = clamp(Math.max(ax, bx), 0, vw()), bottom = clamp(Math.max(ay, by), 0, vh());
    return { x: left, y: top, w: right - left, h: bottom - top };
  };

  // composedPath() on the host hides a closed shadow root's elements, so capture it from inside first.
  let innerPath: HTMLElement[] = [];
  shadow.addEventListener('mousedown', (e) => { innerPath = e.composedPath() as HTMLElement[]; });
  host.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const path = innerPath;
    innerPath = [];
    if (path.includes(bar)) return; // let the buttons handle their own clicks
    e.preventDefault();
    const handle = path.find((n) => n instanceof HTMLElement && n.dataset?.h)?.dataset.h as Handle | undefined;
    if (adjusting && handle) action = { kind: 'resize', handle, orig: { ...rect } };
    else if (adjusting && path.includes(box)) action = { kind: 'move', px: e.clientX, py: e.clientY, orig: { ...rect } };
    else {
      adjusting = false; // dragging outside the box starts a new selection
      action = { kind: 'draw', sx: e.clientX, sy: e.clientY };
      hint.style.display = 'none';
      rect = { x: e.clientX, y: e.clientY, w: 0, h: 0 };
      redraw();
    }
  });
  window.addEventListener('mousemove', onMove, true);
  window.addEventListener('mouseup', onUp, true);
  function onMove(e: MouseEvent) {
    if (!action) return;
    if (action.kind === 'draw') rect = between(action.sx, action.sy, e.clientX, e.clientY);
    else if (action.kind === 'move') {
      const o = action.orig;
      rect = { ...o, x: clamp(o.x + e.clientX - action.px, 0, vw() - o.w), y: clamp(o.y + e.clientY - action.py, 0, vh() - o.h) };
    } else {
      const o = action.orig, h = action.handle;
      let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
      const cx = clamp(e.clientX, 0, vw()), cy = clamp(e.clientY, 0, vh());
      if (h.includes('w')) x1 = cx;
      if (h.includes('e')) x2 = cx;
      if (h.includes('n')) y1 = cy;
      if (h.includes('s')) y2 = cy;
      rect = between(x1, y1, x2, y2); // dragging past the opposite edge flips the box
    }
    redraw();
  }
  function onUp() {
    if (!action) return;
    const was = action;
    action = null;
    if (was.kind === 'draw' && (rect.w < 4 || rect.h < 4)) return cancel();
    adjusting = true;
    hint.textContent = 'Drag the box to move it, drag handles to resize · Enter to capture · Esc to cancel';
    hint.style.display = 'block';
    redraw();
  }
  $('go').addEventListener('click', confirm);
  $('cancel').addEventListener('click', cancel);

  window.addEventListener('keydown', onKey, true);
  document.documentElement.appendChild(host);
})();
