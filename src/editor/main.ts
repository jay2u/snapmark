import { Editor } from './editor';
import { ICONS, TOOL_INFO } from './icons';
import { CONTROLS, EMOJIS, PALETTE, type Control, type Style, type ToolId } from './types';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const workspace = $('workspace');
const ed = new Editor($<HTMLDivElement>('stage'), workspace);

// ---- toast ----------------------------------------------------------------
let toastTimer = 0;
function toast(msg: string) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.hidden = true), 2200);
}

// ---- tool sidebar -----------------------------------------------------------
const toolsEl = $('tools');
const toolButtons = new Map<ToolId, HTMLButtonElement>();
TOOL_INFO.forEach((t, i) => {
  if (i === 1 || t.id === 'crop') toolsEl.append(document.createElement('hr'));
  const b = document.createElement('button');
  b.title = `${t.label} (${t.key})`;
  b.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[t.id]}</svg><kbd>${t.key}</kbd>`;
  b.onclick = () => ed.setTool(t.id);
  toolsEl.append(b);
  toolButtons.set(t.id, b);
});

// ---- options bar ------------------------------------------------------------
const optionsEl = $('options');
let lastOptionsKey = '';

function field(label: string, ...children: HTMLElement[]) {
  const d = document.createElement('div');
  d.className = 'opt';
  if (label) d.append(label);
  d.append(...children);
  return d;
}

function renderOptions() {
  const kind = ed.activeKind();
  const s = ed.activeStyle();
  // Re-build only when the set of controls changes; otherwise just refresh values (keeps sliders draggable).
  const key = `${kind}|${ed.tool}|${ed.selection.length}`;
  if (key !== lastOptionsKey) {
    lastOptionsKey = key;
    optionsEl.replaceChildren();
    if (!kind || !s) {
      const tip = TOOL_INFO.find((t) => t.id === ed.tool)?.tip ?? '';
      optionsEl.append(Object.assign(document.createElement('span'), { className: 'hint', textContent: tip }));
      return;
    }
    for (const c of CONTROLS[kind]) optionsEl.append(buildControl(c, kind, s));
    if (kind === 'emoji') optionsEl.append(emojiPicker());
    if (ed.selection.length) optionsEl.append(selectionActions());
  }
  if (kind && s) refreshControls(s);
}

const refreshers: ((s: Style) => void)[] = [];
function buildControl(c: Control, kind: string, s: Style): HTMLElement {
  const set = (p: Partial<Style>) => ed.setStyle(p);
  switch (c) {
    case 'color': {
      const wrap = document.createElement('div');
      wrap.className = 'swatches';
      const btns = PALETTE.map((col) => {
        const b = document.createElement('button');
        b.className = 'swatch';
        b.style.background = col;
        b.title = col;
        b.onclick = () => set({ color: col });
        wrap.append(b);
        return [col, b] as const;
      });
      const input = document.createElement('input');
      input.type = 'color';
      input.title = 'Custom colour';
      input.oninput = () => set({ color: input.value });
      wrap.append(input);
      refreshers.push((st) => {
        btns.forEach(([col, b]) => b.classList.toggle('on', col === st.color.toLowerCase()));
        input.value = st.color;
      });
      return wrap;
    }
    case 'width':
    case 'opacity':
    case 'fontSize': {
      const cfg = {
        width: { label: kind === 'blur' ? 'Strength' : 'Size', min: 1, max: kind === 'highlighter' ? 60 : 30, step: 1 },
        opacity: { label: kind === 'spotlight' ? 'Dimming' : 'Opacity', min: 0.1, max: 1, step: 0.05 },
        fontSize: { label: kind === 'emoji' || kind === 'step' ? 'Size' : 'Font', min: 10, max: 120, step: 1 },
      }[c];
      const input = document.createElement('input');
      Object.assign(input, { type: 'range', min: String(cfg.min), max: String(cfg.max), step: String(cfg.step) });
      const val = document.createElement('span');
      val.className = 'val';
      input.oninput = () => set({ [c]: Number(input.value) });
      refreshers.push((st) => {
        input.value = String(st[c]);
        val.textContent = c === 'opacity' ? `${Math.round(st.opacity * 100)}%` : String(st[c]);
      });
      return field(cfg.label, input, val);
    }
    case 'fill':
    case 'shadow':
    case 'rounded': {
      const label = c === 'fill' ? (kind === 'text' || kind === 'callout' ? 'Background' : 'Fill') : c === 'shadow' ? 'Shadow' : 'Rounded';
      const b = document.createElement('button');
      b.className = 'toggle';
      b.textContent = label;
      b.onclick = () => set({ [c]: !(ed.activeStyle() as Style)[c] });
      refreshers.push((st) => b.classList.toggle('on', st[c]));
      return b;
    }
    case 'mode': {
      const row = document.createElement('div');
      row.className = 'pill-row';
      const modes: Style['mode'][] = ['pixelate', 'blur'];
      const bs = modes.map((m) => {
        const b = document.createElement('button');
        b.className = 'toggle';
        b.textContent = m === 'pixelate' ? 'Pixelate' : 'Blur';
        b.onclick = () => set({ mode: m });
        row.append(b);
        return [m, b] as const;
      });
      refreshers.push((st) => bs.forEach(([m, b]) => b.classList.toggle('on', st.mode === m)));
      return row;
    }
  }
}

function refreshControls(s: Style) {
  refreshers.forEach((r) => r(s));
}

function emojiPicker() {
  const row = document.createElement('div');
  row.className = 'emojis';
  const bs = EMOJIS.map((e) => {
    const b = document.createElement('button');
    b.textContent = e;
    b.onclick = () => {
      ed.emoji = e;
      bs.forEach((x) => x.classList.toggle('on', x === b));
    };
    b.classList.toggle('on', e === ed.emoji);
    row.append(b);
    return b;
  });
  return row;
}

function selectionActions() {
  const row = document.createElement('div');
  row.className = 'pill-row';
  const mk = (label: string, title: string, fn: () => void) => {
    const b = document.createElement('button');
    b.className = 'toggle';
    b.textContent = label;
    b.title = title;
    b.onclick = fn;
    row.append(b);
  };
  mk('Duplicate', 'Ctrl+D', () => ed.duplicateSelection());
  mk('Forward', 'Bring forward', () => ed.reorder('up'));
  mk('Back', 'Send backward', () => ed.reorder('down'));
  mk('Delete', 'Delete', () => ed.deleteSelection());
  return row;
}

// ---- top bar -----------------------------------------------------------------
const undoBtn = $<HTMLButtonElement>('undo');
const redoBtn = $<HTMLButtonElement>('redo');
undoBtn.onclick = () => ed.undo();
redoBtn.onclick = () => ed.redo();
$('zoomOut').onclick = () => ed.setZoom(ed.zoom / 1.25);
$('zoomIn').onclick = () => ed.setZoom(ed.zoom * 1.25);
$('zoomLabel').onclick = () => ed.fit();
$('zoom100').onclick = () => ed.setZoom(1);
$('clear').onclick = () => {
  if (confirm('Remove all annotations?')) ed.clearAll();
};
$('history').onclick = () => (location.href = chrome.runtime.getURL('src/history/history.html'));

const formatSel = $<HTMLSelectElement>('format');
const qualityEl = $<HTMLInputElement>('quality');
formatSel.onchange = () => {
  $('qualityWrap').hidden = formatSel.value !== 'jpeg';
  chrome.storage.local.set({ format: formatSel.value, quality: Number(qualityEl.value) });
};
qualityEl.onchange = formatSel.onchange;
chrome.storage.local.get(['format', 'quality']).then((s) => {
  if (s.format) formatSel.value = String(s.format);
  if (s.quality) qualityEl.value = String(s.quality);
  $('qualityWrap').hidden = formatSel.value !== 'jpeg';
});

function filename() {
  const slug = ed.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'screenshot';
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `snapmark-${slug}-${stamp}.${formatSel.value === 'jpeg' ? 'jpg' : 'png'}`;
}

async function download() {
  ed.clearSelection();
  const jpeg = formatSel.value === 'jpeg';
  const blob = await ed.toBlob(jpeg ? 'image/jpeg' : 'image/png', Number(qualityEl.value) / 100);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename();
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  toast('Saved to Downloads');
  ed.saveNow().catch(() => {});
}

async function copy() {
  ed.clearSelection();
  try {
    // Clipboard only reliably accepts PNG.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': ed.toBlob('image/png') })]);
    toast('Copied to clipboard');
  } catch (e) {
    toast(`Copy failed: ${e instanceof Error ? e.message : e}`);
  }
}
$('download').onclick = download;
$('copy').onclick = copy;

// ---- state -> UI -------------------------------------------------------------
function refresh() {
  toolButtons.forEach((b, id) => b.classList.toggle('active', id === ed.tool));
  undoBtn.disabled = !ed.canUndo;
  redoBtn.disabled = !ed.canRedo;
  $('zoomLabel').textContent = `${Math.round(ed.zoom * 100)}%`;
  if (ed.base) $('size').textContent = `${ed.width} × ${ed.height} px`;
  $('tip').textContent = TOOL_INFO.find((t) => t.id === ed.tool)?.tip ?? '';
  renderOptions();
}
ed.on(refresh);

// ---- keyboard ----------------------------------------------------------------
const KEYS = new Map(TOOL_INFO.map((t) => [t.key.toLowerCase(), t.id]));
let spaceDown = false;

window.addEventListener('keydown', (e) => {
  if (ed.isEditingText) return;
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range') return;
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();

  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? ed.redo() : ed.undo(); }
  else if (mod && k === 'y') { e.preventDefault(); ed.redo(); }
  else if (mod && k === 'd') { e.preventDefault(); ed.duplicateSelection(); }
  else if (mod && k === 's') { e.preventDefault(); download(); }
  else if (mod && k === 'c' && !window.getSelection()?.toString()) { e.preventDefault(); copy(); }
  else if (mod && (k === '=' || k === '+')) { e.preventDefault(); ed.setZoom(ed.zoom * 1.25); }
  else if (mod && k === '-') { e.preventDefault(); ed.setZoom(ed.zoom / 1.25); }
  else if (mod && k === '0') { e.preventDefault(); ed.fit(); }
  else if (!mod && (k === 'delete' || k === 'backspace')) { e.preventDefault(); ed.deleteSelection(); }
  else if (k === 'escape') { ed.clearSelection(); if (ed.tool !== 'select') ed.setTool('select'); }
  else if (!mod && k.startsWith('arrow') && ed.selection.length) {
    e.preventDefault();
    const d = e.shiftKey ? 10 : 1;
    ed.nudge(k === 'arrowleft' ? -d : k === 'arrowright' ? d : 0, k === 'arrowup' ? -d : k === 'arrowdown' ? d : 0);
  }
  else if (k === ' ') { spaceDown = true; e.preventDefault(); }
  else if (!mod && !e.altKey && KEYS.has(k)) ed.setTool(KEYS.get(k)!);
});
window.addEventListener('keyup', (e) => { if (e.key === ' ') spaceDown = false; });

// Space + drag pans; Ctrl + wheel zooms.
let pan: { x: number; y: number; sl: number; st: number } | null = null;
workspace.addEventListener('mousedown', (e) => {
  if (!spaceDown && e.button !== 1) return;
  e.preventDefault();
  e.stopPropagation();
  pan = { x: e.clientX, y: e.clientY, sl: workspace.scrollLeft, st: workspace.scrollTop };
  workspace.classList.add('panning');
}, true);
window.addEventListener('mousemove', (e) => {
  if (!pan) return;
  workspace.scrollLeft = pan.sl - (e.clientX - pan.x);
  workspace.scrollTop = pan.st - (e.clientY - pan.y);
});
window.addEventListener('mouseup', () => { pan = null; workspace.classList.remove('panning'); });
workspace.addEventListener('wheel', (e) => {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  ed.setZoom(ed.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
}, { passive: false });

window.addEventListener('resize', () => { /* keep current zoom */ });
window.addEventListener('beforeunload', () => { ed.saveNow().catch(() => {}); });

// ---- boot ----------------------------------------------------------------------
const id = new URLSearchParams(location.search).get('id');
if (!id) {
  document.body.textContent = 'No capture selected. Open one from the Snapmark history.';
} else {
  ed.load(id).then(refresh).catch((e) => {
    document.body.innerHTML = `<p style="padding:40px;font:16px system-ui">${String(e.message ?? e)}</p>`;
  });
}
refresh();
