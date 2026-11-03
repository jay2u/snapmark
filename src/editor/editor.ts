import Konva from 'konva';
import { getCapture, saveState, type SavedState } from '../shared/db';
import { makeThumb } from '../shared/image';
import {
  kindOf, newBlur, newSpotlight, paint, refreshBlur, styleOf, type View,
} from './nodes';
import { deserialize, serialize } from './serialize';
import { DEFAULT_STYLES, type Kind, type Rect, type Style, type ToolId, type Vec } from './types';
import { createTools, type Tool } from './tools';

interface Snapshot {
  base: HTMLCanvasElement;
  offset: Vec;
  nodes: string[];
}

const MAX_UNDO = 100;
const LINE_KINDS: Kind[] = ['arrow', 'curve', 'line'];
const NO_ROTATE: Kind[] = ['blur', 'spotlight', 'step'];
const KEEP_RATIO: Kind[] = ['text', 'callout', 'step', 'emoji'];

export class Editor {
  readonly stage: Konva.Stage;
  readonly baseLayer = new Konva.Layer({ listening: false });
  readonly annLayer = new Konva.Layer();
  readonly uiLayer = new Konva.Layer();
  private baseImage = new Konva.Image({ image: undefined });
  private tr: Konva.Transformer;
  private handles = new Konva.Group();

  id = '';
  title = 'screenshot';
  base!: HTMLCanvasElement;
  private original!: HTMLCanvasElement;
  private offset: Vec = { x: 0, y: 0 };
  zoom = 1;
  tool: ToolId = 'arrow';
  emoji = '✔️';
  selection: Konva.Node[] = [];
  styles: Record<Kind, Style> = structuredClone(DEFAULT_STYLES);
  private tools: Record<ToolId, Tool>;

  private undoStack: Snapshot[] = [];
  private undoIndex = -1;
  private saveTimer = 0;
  private listeners = new Set<() => void>();
  private editing = false;

  constructor(container: HTMLDivElement, private workspace: HTMLElement) {
    this.stage = new Konva.Stage({ container, width: 1, height: 1 });
    this.stage.add(this.baseLayer, this.annLayer, this.uiLayer);
    this.baseLayer.add(this.baseImage);

    this.tr = new Konva.Transformer({
      anchorSize: 9, anchorCornerRadius: 2, borderStroke: '#4f8cff', anchorStroke: '#4f8cff', anchorFill: '#fff',
      rotateAnchorOffset: 24, rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315], rotationSnapTolerance: 5,
      keepRatio: false, ignoreStroke: true,
    });
    this.uiLayer.add(this.tr, this.handles);
    this.tools = createTools(this);

    this.annLayer.on('dragmove', () => this.syncHandles());
    this.annLayer.on('dragend', (e) => {
      const n = this.topLevel(e.target);
      if (n && kindOf(n) === 'blur') refreshBlur(n as Konva.Image, this.base);
      this.commit();
    });
    this.tr.on('transformend', () => {
      for (const n of this.selection) this.normalize(n);
      this.commit();
    });

    const pointer = (fn: 'down' | 'move' | 'up') => (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (this.editing) return;
      const p = this.pointer();
      this.tools[this.tool][fn](p, e.evt, e.target);
    };
    this.stage.on('mousedown touchstart', pointer('down'));
    this.stage.on('touchmove', pointer('move'));
    // Mouse move/up come from the window so drags keep working past the canvas edge,
    // and positions come from the DOM event (Konva's cached pointer can be stale after release).
    window.addEventListener('mousemove', (e) => {
      if (!this.editing) this.tools[this.tool].move(this.pointFromEvent(e), e);
    });
    window.addEventListener('mouseup', (e) => {
      if (!this.editing) this.tools[this.tool].up(this.pointFromEvent(e), e);
    });
    this.stage.on('dblclick dbltap', (e) => {
      const n = this.topLevel(e.target);
      if (n && (kindOf(n) === 'text' || kindOf(n) === 'callout')) this.editText(n as Konva.Label);
    });
    this.setTool('arrow');
  }

  // ---- events -------------------------------------------------------------

  on(fn: () => void) { this.listeners.add(fn); }
  private emit() { this.listeners.forEach((f) => f()); }

  // ---- loading ------------------------------------------------------------

  async load(id: string) {
    const found = await getCapture(id);
    if (!found) throw new Error('This capture no longer exists.');
    this.id = id;
    this.title = found.meta.title;
    const bmp = await createImageBitmap(found.record.blob);
    this.original = document.createElement('canvas');
    this.original.width = bmp.width;
    this.original.height = bmp.height;
    this.original.getContext('2d')!.drawImage(bmp, 0, 0);

    const saved = found.record.saved;
    if (saved?.crop) {
      const { x, y, w, h } = saved.crop;
      this.offset = { x, y };
      this.setBase(this.cut(this.original, { x, y, w, h }));
    } else {
      this.offset = { x: 0, y: 0 };
      this.setBase(this.original);
    }
    for (const s of saved?.nodes ?? []) this.annLayer.add(deserialize(s, this.ctx()) as Konva.Shape);
    this.fit();
    this.pushSnapshot();
    this.emit();
    await this.loadStyles();
  }

  private ctx() { return { base: () => this.base, view: () => this.view() }; }
  view(): View { return { width: this.base.width, height: this.base.height, zoom: this.zoom }; }
  get width() { return this.base.width; }
  get height() { return this.base.height; }

  private async loadStyles() {
    try {
      const { styles } = (await chrome.storage.local.get('styles')) as { styles?: Record<string, Partial<Style>> };
      if (styles) for (const k of Object.keys(this.styles) as Kind[]) if (styles[k]) Object.assign(this.styles[k], styles[k]);
      this.emit();
    } catch { /* storage unavailable */ }
  }

  private cut(src: HTMLCanvasElement, r: Rect) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(r.w));
    c.height = Math.max(1, Math.round(r.h));
    c.getContext('2d')!.drawImage(src, r.x, r.y, c.width, c.height, 0, 0, c.width, c.height);
    return c;
  }

  private setBase(c: HTMLCanvasElement) {
    this.base = c;
    this.baseImage.setAttrs({ image: c, width: c.width, height: c.height });
    this.applyZoom();
  }

  // ---- zoom ---------------------------------------------------------------

  private applyZoom() {
    this.stage.size({ width: this.base.width * this.zoom, height: this.base.height * this.zoom });
    this.stage.scale({ x: this.zoom, y: this.zoom });
    this.syncHandles();
  }
  setZoom(z: number) {
    const ws = this.workspace;
    const rx = ws.scrollWidth ? (ws.scrollLeft + ws.clientWidth / 2) / ws.scrollWidth : 0;
    const ry = ws.scrollHeight ? (ws.scrollTop + ws.clientHeight / 2) / ws.scrollHeight : 0;
    this.zoom = Math.min(4, Math.max(0.05, z));
    this.applyZoom();
    ws.scrollLeft = rx * ws.scrollWidth - ws.clientWidth / 2;
    ws.scrollTop = ry * ws.scrollHeight - ws.clientHeight / 2;
    this.emit();
  }
  fit() {
    const availW = this.workspace.clientWidth - 48, availH = this.workspace.clientHeight - 48;
    // Very tall (full-page) captures fit to width instead of becoming a thin sliver.
    this.setZoom(Math.min(1, availW / this.base.width, Math.max(availH / this.base.height, 0.4)));
  }

  // ---- pointer / tools ----------------------------------------------------

  /** Canvas coordinates of a mouse event, clamped to the image. */
  pointFromEvent(e: MouseEvent): Vec {
    const r = this.stage.container().getBoundingClientRect();
    return {
      x: Math.min(this.base.width, Math.max(0, (e.clientX - r.left) / this.zoom)),
      y: Math.min(this.base.height, Math.max(0, (e.clientY - r.top) / this.zoom)),
    };
  }

  pointer(): Vec { return this.annLayer.getRelativePointerPosition() ?? { x: 0, y: 0 }; }

  setTool(t: ToolId) {
    this.tools[this.tool]?.cancel?.();
    this.tool = t;
    this.annLayer.listening(t === 'select');
    this.stage.container().style.cursor = t === 'select' ? 'default' : 'crosshair';
    if (t !== 'select') this.clearSelection();
    this.emit();
  }

  topLevel(n: Konva.Node | null | undefined): Konva.Node | null {
    while (n && n.getParent() !== this.annLayer) n = n.getParent();
    return n ?? null;
  }

  // ---- selection ----------------------------------------------------------

  select(nodes: Konva.Node[]) {
    this.selection = nodes;
    this.updateSelectionUI();
    this.emit();
  }
  clearSelection() { if (this.selection.length) this.select([]); }

  private updateSelectionUI() {
    this.handles.destroyChildren();
    const nodes = this.selection;
    const single = nodes.length === 1 ? nodes[0] : null;
    if (single && LINE_KINDS.includes(kindOf(single))) {
      this.tr.nodes([]);
      this.buildHandles(single as Konva.Line);
    } else {
      this.tr.nodes(nodes);
      const kinds = nodes.map(kindOf);
      this.tr.rotateEnabled(!kinds.some((k) => NO_ROTATE.includes(k)));
      this.tr.keepRatio(kinds.length > 0 && kinds.every((k) => KEEP_RATIO.includes(k)));
    }
    this.uiLayer.batchDraw();
  }

  /** Draggable end/control points for arrows and lines. */
  private buildHandles(node: Konva.Line) {
    const pts = node.points();
    const mid = kindOf(node) === 'curve' ? 1 : -1;
    for (let i = 0; i < pts.length / 2; i++) {
      const c = new Konva.Circle({
        radius: 6 / this.zoom, fill: i === mid ? '#4f8cff' : '#ffffff', stroke: '#4f8cff', strokeWidth: 2 / this.zoom,
        draggable: true, name: 'handle',
      });
      c.on('dragmove', () => {
        const local = node.getTransform().copy().invert().point(c.position());
        const next = node.points().slice();
        next[i * 2] = local.x;
        next[i * 2 + 1] = local.y;
        node.points(next);
      });
      c.on('dragend', () => this.commit());
      this.handles.add(c);
    }
    this.syncHandles();
  }

  private syncHandles() {
    const n = this.selection.length === 1 ? (this.selection[0] as Konva.Line) : null;
    if (!n || !LINE_KINDS.includes(kindOf(n))) return;
    const t = n.getTransform();
    const pts = n.points();
    this.handles.getChildren().forEach((c, i) => {
      c.position(t.point({ x: pts[i * 2], y: pts[i * 2 + 1] }));
      (c as Konva.Circle).radius(6 / this.zoom);
      (c as Konva.Circle).strokeWidth(2 / this.zoom);
    });
    this.uiLayer.batchDraw();
  }

  /** Fold transformer scale into real sizes so strokes and filters stay crisp. */
  private normalize(n: Konva.Node) {
    const sx = n.scaleX(), sy = n.scaleY();
    const kind = kindOf(n);
    if (kind === 'rect' || kind === 'spotlight' || kind === 'blur') {
      n.setAttrs({ width: n.width() * sx, height: n.height() * sy, scaleX: 1, scaleY: 1 });
      if (kind === 'blur') refreshBlur(n as Konva.Image, this.base);
    } else if (kind === 'ellipse') {
      const e = n as Konva.Ellipse;
      e.setAttrs({ radiusX: e.radiusX() * sx, radiusY: e.radiusY() * sy, scaleX: 1, scaleY: 1 });
    }
  }

  // ---- adding / editing nodes --------------------------------------------

  add(node: Konva.Node) {
    this.annLayer.add(node as Konva.Shape);
    this.annLayer.batchDraw();
  }

  nextStepNumber() {
    let max = 0;
    for (const n of this.annLayer.getChildren()) {
      if (kindOf(n) === 'step') max = Math.max(max, parseInt((n as Konva.Group).findOne<Konva.Text>('Text')?.text() ?? '0') || 0);
    }
    return max + 1;
  }

  newBlur(r: Rect, s: Style) { return newBlur(this.base, r, s); }
  newSpotlight(r: Rect, s: Style) { return newSpotlight(r, s, () => this.view()); }

  deleteSelection() {
    if (!this.selection.length) return;
    this.selection.forEach((n) => n.destroy());
    this.select([]);
    this.commit();
  }

  duplicateSelection() {
    const copies = this.selection.map((n) => {
      const c = deserialize(serialize(n), this.ctx());
      c.position({ x: c.x() + 16, y: c.y() + 16 });
      this.add(c);
      return c;
    });
    if (copies.length) {
      this.select(copies);
      this.commit();
    }
  }

  nudge(dx: number, dy: number) {
    this.selection.forEach((n) => n.position({ x: n.x() + dx, y: n.y() + dy }));
    this.syncHandles();
    this.annLayer.batchDraw();
    this.commit();
  }

  reorder(how: 'up' | 'down' | 'top' | 'bottom') {
    for (const n of this.selection) {
      if (how === 'up') n.moveUp();
      else if (how === 'down') n.moveDown();
      else if (how === 'top') n.moveToTop();
      else n.moveToBottom();
    }
    this.commit();
  }

  clearAll() {
    this.annLayer.destroyChildren();
    this.select([]);
    this.commit();
  }

  /** Crop the canvas to `r` (in current canvas coordinates); annotations shift with it. */
  crop(r: Rect) {
    const x = Math.max(0, Math.round(r.x)), y = Math.max(0, Math.round(r.y));
    const w = Math.min(this.base.width - x, Math.round(r.w)), h = Math.min(this.base.height - y, Math.round(r.h));
    if (w < 2 || h < 2) return;
    this.clearSelection();
    this.setBase(this.cut(this.base, { x, y, w, h }));
    this.offset = { x: this.offset.x + x, y: this.offset.y + y };
    this.annLayer.getChildren().forEach((n) => n.position({ x: n.x() - x, y: n.y() - y }));
    this.fit();
    this.commit();
  }

  // ---- styles -------------------------------------------------------------

  /** Kind whose options the UI should show. */
  activeKind(): Kind | null {
    if (this.selection.length) return kindOf(this.selection[0]);
    return this.tool === 'select' || this.tool === 'crop' ? null : this.tool;
  }
  activeStyle(): Style | null {
    if (this.selection.length) return styleOf(this.selection[0]);
    const k = this.activeKind();
    return k ? this.styles[k] : null;
  }

  setStyle(patch: Partial<Style>) {
    if (this.selection.length) {
      for (const n of this.selection) {
        paint(n, { ...styleOf(n), ...patch });
        if (kindOf(n) === 'blur') refreshBlur(n as Konva.Image, this.base);
      }
      this.annLayer.batchDraw();
      this.syncHandles();
      this.commit();
    } else {
      const k = this.activeKind();
      if (!k) return;
      Object.assign(this.styles[k], patch);
      chrome.storage.local.set({ styles: this.styles }).catch(() => {});
    }
    this.emit();
  }

  // ---- inline text editing -----------------------------------------------

  editText(label: Konva.Label) {
    const text = label.getText();
    const abs = text.getAbsolutePosition();
    const ta = document.createElement('textarea');
    const scale = this.zoom * label.scaleX();
    ta.value = text.text();
    Object.assign(ta.style, {
      position: 'absolute', left: `${abs.x}px`, top: `${abs.y}px`, zIndex: '10',
      font: `${text.fontSize() * scale}px/${text.lineHeight()} ${text.fontFamily()}`,
      padding: `${text.padding() * scale}px`, color: String(text.fill()), minWidth: '60px',
      background: 'rgba(255,255,255,0.85)', border: '1px dashed #4f8cff', outline: 'none', resize: 'none',
      overflow: 'hidden', whiteSpace: 'pre', fieldSizing: 'content', margin: '0',
    });
    if (String(text.fill()) === '#ffffff') ta.style.background = 'rgba(30,30,30,0.85)';
    this.stage.content.appendChild(ta);
    text.visible(false);
    this.editing = true;
    this.annLayer.batchDraw();
    // Deferred: the mousedown that created this label would otherwise move focus away again.
    setTimeout(() => { ta.focus(); ta.select(); }, 0);

    let done = false;
    const finish = (apply: boolean) => {
      if (done) return;
      done = true;
      const value = ta.value.replace(/\s+$/, '');
      ta.remove();
      text.visible(true);
      this.editing = false;
      const isNew = label.getAttr('snapNew') === true;
      if (apply && value) {
        text.text(value);
        label.setAttr('snapNew', false);
      } else if (isNew || apply) {
        label.destroy(); // cancelled new label, or the user emptied an existing one
      }
      if (label.getStage()) this.select([label]);
      this.annLayer.batchDraw();
      this.commit();
    };
    ta.addEventListener('blur', () => finish(true));
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') finish(false);
      else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true); }
    });
  }

  get isEditingText() { return this.editing; }

  // ---- undo / redo --------------------------------------------------------

  get canUndo() { return this.undoIndex > 0; }
  get canRedo() { return this.undoIndex < this.undoStack.length - 1; }

  private pushSnapshot() {
    this.undoStack.length = this.undoIndex + 1;
    this.undoStack.push({
      base: this.base,
      offset: { ...this.offset },
      nodes: this.annLayer.getChildren().map(serialize),
    });
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.undoIndex = this.undoStack.length - 1;
  }

  /** Record the current state as an undo step and schedule an autosave. */
  commit() {
    this.pushSnapshot();
    this.annLayer.batchDraw();
    this.scheduleSave();
    this.emit();
  }

  undo() { if (this.canUndo) this.restore(--this.undoIndex); }
  redo() { if (this.canRedo) this.restore(++this.undoIndex); }

  private restore(i: number) {
    const snap = this.undoStack[i];
    const resized = snap.base !== this.base;
    this.clearSelection();
    this.offset = { ...snap.offset };
    if (resized) this.setBase(snap.base);
    this.annLayer.destroyChildren();
    for (const s of snap.nodes) this.annLayer.add(deserialize(s, this.ctx()) as Konva.Shape);
    if (resized) this.fit();
    this.annLayer.batchDraw();
    this.scheduleSave();
    this.emit();
  }

  // ---- persistence / export ----------------------------------------------

  private savedState(): SavedState {
    const cropped = this.offset.x || this.offset.y || this.base !== this.original;
    return {
      crop: cropped ? { x: this.offset.x, y: this.offset.y, w: this.base.width, h: this.base.height } : null,
      nodes: this.annLayer.getChildren().map(serialize),
    };
  }

  private scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.saveNow(), 1200);
  }

  async saveNow() {
    if (!this.id) return;
    clearTimeout(this.saveTimer);
    const thumb = await makeThumb(await createImageBitmap(this.renderCanvas()));
    await saveState(this.id, this.savedState(), thumb);
  }

  /** Flatten image + annotations at full resolution (no selection UI). */
  renderCanvas(): HTMLCanvasElement {
    const prev = this.zoom;
    this.uiLayer.hide();
    this.zoom = 1;
    this.applyZoom();
    const canvas = this.stage.toCanvas({ pixelRatio: 1 });
    this.uiLayer.show();
    this.zoom = prev;
    this.applyZoom();
    return canvas;
  }

  toBlob(type: 'image/png' | 'image/jpeg', quality = 0.92): Promise<Blob> {
    const c = this.renderCanvas();
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Export failed'))), type, quality));
  }
}
