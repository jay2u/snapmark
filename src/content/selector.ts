// Injected on demand. Lets the user drag a rectangle over the page, then reports it.
// Self-contained on purpose: injected as a classic script, so no imports.
(() => {
  const w = window as unknown as { __snapmarkSelecting?: boolean };
  if (w.__snapmarkSelecting) return;
  w.__snapmarkSelecting = true;

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;user-select:none;';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>
      .dim { position:fixed; background:rgba(0,0,0,.55); }
      .box { position:fixed; border:2px solid #4f8cff; box-sizing:border-box; display:none; }
      .tag { position:fixed; background:#1f2937; color:#fff; font:12px/1 system-ui,sans-serif;
             padding:4px 6px; border-radius:4px; display:none; pointer-events:none; }
      .hint { position:fixed; top:12px; left:50%; transform:translateX(-50%); background:#1f2937; color:#fff;
              font:13px system-ui,sans-serif; padding:8px 14px; border-radius:8px; pointer-events:none; }
    </style>
    <div class="dim" id="full" style="inset:0"></div>
    <div class="dim" id="t"></div><div class="dim" id="b"></div>
    <div class="dim" id="l"></div><div class="dim" id="r"></div>
    <div class="box" id="box"></div><div class="tag" id="tag"></div>
    <div class="hint" id="hint">Drag to select an area &middot; Esc to cancel</div>`;
  const $ = (id: string) => shadow.getElementById(id) as HTMLElement;
  const [full, t, b, l, r, box, tag, hint] = ['full', 't', 'b', 'l', 'r', 'box', 'tag', 'hint'].map($);
  [t, b, l, r].forEach((e) => (e.style.display = 'none'));

  let sx = 0, sy = 0, dragging = false;
  const vw = () => document.documentElement.clientWidth;
  const vh = () => document.documentElement.clientHeight;

  function rectFrom(x: number, y: number) {
    const left = Math.max(0, Math.min(sx, x)), top = Math.max(0, Math.min(sy, y));
    const right = Math.min(vw(), Math.max(sx, x)), bottom = Math.min(vh(), Math.max(sy, y));
    return { x: left, y: top, w: right - left, h: bottom - top };
  }
  function draw(rc: { x: number; y: number; w: number; h: number }) {
    full.style.display = 'none';
    [t, b, l, r].forEach((e) => (e.style.display = 'block'));
    Object.assign(t.style, { left: '0', top: '0', width: '100vw', height: rc.y + 'px' });
    Object.assign(b.style, { left: '0', top: rc.y + rc.h + 'px', width: '100vw', height: vh() - rc.y - rc.h + 'px' });
    Object.assign(l.style, { left: '0', top: rc.y + 'px', width: rc.x + 'px', height: rc.h + 'px' });
    Object.assign(r.style, { left: rc.x + rc.w + 'px', top: rc.y + 'px', width: vw() - rc.x - rc.w + 'px', height: rc.h + 'px' });
    Object.assign(box.style, { display: 'block', left: rc.x + 'px', top: rc.y + 'px', width: rc.w + 'px', height: rc.h + 'px' });
    tag.textContent = `${Math.round(rc.w)} × ${Math.round(rc.h)}`;
    Object.assign(tag.style, { display: 'block', left: rc.x + 'px', top: Math.max(0, rc.y - 24) + 'px' });
  }

  function cleanup() {
    host.remove();
    window.removeEventListener('keydown', onKey, true);
    w.__snapmarkSelecting = false;
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cleanup();
      chrome.runtime.sendMessage({ type: 'region-cancelled' });
    }
  }

  host.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragging = true;
    sx = e.clientX;
    sy = e.clientY;
    hint.style.display = 'none';
    draw({ x: sx, y: sy, w: 0, h: 0 });
  });
  host.addEventListener('mousemove', (e) => {
    if (dragging) draw(rectFrom(e.clientX, e.clientY));
  });
  host.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    dragging = false;
    const rc = rectFrom(e.clientX, e.clientY);
    cleanup();
    if (rc.w < 4 || rc.h < 4) chrome.runtime.sendMessage({ type: 'region-cancelled' });
    else chrome.runtime.sendMessage({ type: 'region-selected', rect: rc });
  });

  window.addEventListener('keydown', onKey, true);
  document.documentElement.appendChild(host);
})();
