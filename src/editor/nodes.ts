import Konva from 'konva';
import { arrowPolygon } from './geometry';
import type { Kind, Rect, Style, Vec } from './types';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

/** Gives nodes what they need to size the full-canvas dim layer (spotlight). */
export interface View { width: number; height: number; zoom: number }

export function hexToRgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export function contrast(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62 ? '#111111' : '#ffffff';
}

export const kindOf = (n: Konva.Node) => n.getAttr('snapKind') as Kind;
export const styleOf = (n: Konva.Node) => n.getAttr('snapStyle') as Style;

function setShadow(n: Konva.Node, on: boolean) {
  n.setAttrs({ shadowEnabled: on, shadowColor: '#000', shadowBlur: 8, shadowOffset: { x: 2, y: 2 }, shadowOpacity: 0.4 });
}

/** Apply a style to a node. Everything visual is derived from `snapStyle`. */
export function paint(node: Konva.Node, s: Style) {
  const kind = kindOf(node);
  node.setAttr('snapStyle', s);
  switch (kind) {
    case 'arrow':
      // Tapered shape; Size scales it. A thin same-colour outline softens the corners.
      node.setAttrs({ fill: s.color, stroke: s.color, strokeWidth: 1.5, opacity: s.opacity });
      setShadow(node, s.shadow);
      break;
    case 'curve': {
      const a = node as Konva.Arrow;
      const length = 12 + s.width * 3;
      const headWidth = 14 + s.width * 4.5;
      a.setAttrs({ stroke: s.color, fill: s.color, strokeWidth: s.width, pointerLength: length, pointerWidth: headWidth, opacity: s.opacity, hitStrokeWidth: Math.max(14, s.width) });
      setShadow(a, s.shadow);
      break;
    }
    case 'line':
    case 'pen':
    case 'highlighter':
      node.setAttrs({ stroke: s.color, strokeWidth: s.width, opacity: s.opacity, hitStrokeWidth: Math.max(14, s.width) });
      if (kind === 'line') setShadow(node, s.shadow);
      break;
    case 'rect':
    case 'ellipse':
      node.setAttrs({
        stroke: s.color, strokeWidth: s.width, opacity: s.opacity,
        fill: s.fill ? hexToRgba(s.color, 0.3) : 'rgba(0,0,0,0)',
        cornerRadius: kind === 'rect' && s.rounded ? 12 : 0,
      });
      setShadow(node, s.shadow);
      break;
    case 'text':
    case 'callout': {
      const label = node as Konva.Label;
      const tag = label.getTag(), text = label.getText();
      text.setAttrs({ fontSize: s.fontSize });
      if (kind === 'text') {
        tag.setAttrs({ fill: s.fill ? s.color : 'rgba(0,0,0,0)', cornerRadius: s.fill ? 4 : 0 });
        text.fill(s.fill ? contrast(s.color) : s.color);
      } else {
        tag.setAttrs({ fill: s.fill ? s.color : '#ffffff', stroke: s.color, strokeWidth: 2 });
        text.fill(s.fill ? contrast(s.color) : '#111111');
      }
      label.opacity(s.opacity);
      setShadow(label, s.shadow);
      break;
    }
    case 'step': {
      const g = node as Konva.Group;
      const c = g.findOne('Circle') as Konva.Circle, t = g.findOne('Text') as Konva.Text;
      const r = s.fontSize * 0.95;
      c.setAttrs({ radius: r, fill: s.color, stroke: '#ffffff', strokeWidth: 2 });
      t.setAttrs({ fontSize: s.fontSize, width: r * 2, height: r * 2, offsetX: r, offsetY: r, fill: contrast(s.color) });
      g.opacity(s.opacity);
      setShadow(g, s.shadow);
      break;
    }
    case 'emoji': {
      const t = node as Konva.Text;
      t.fontSize(s.fontSize);
      t.setAttrs({ offsetX: t.width() / 2, offsetY: t.height() / 2, opacity: s.opacity });
      break;
    }
    case 'spotlight':
      node.setAttr('dim', s.opacity);
      break;
    case 'blur':
      break; // pixels are produced by refreshBlur()
  }
}

function init<T extends Konva.Node>(node: T, kind: Kind, s: Style): T {
  node.setAttrs({ snapKind: kind, draggable: true });
  paint(node, s);
  return node;
}

/** Draw a line node as a tapered arrow (functions can't be serialized, so this is re-applied on load). */
export function attachArrowShape(node: Konva.Line) {
  const trace = (ctx: Konva.Context, shape: Konva.Shape) => {
    const poly = arrowPolygon((shape as Konva.Line).points(), styleOf(shape).width);
    if (!poly.length) return;
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (const q of poly.slice(1)) ctx.lineTo(q.x, q.y);
    ctx.closePath();
    ctx.fillStrokeShape(shape);
  };
  node.sceneFunc(trace);
  node.hitFunc(trace);
  return node;
}

export function newLine(kind: 'arrow' | 'curve' | 'line', pts: number[], s: Style) {
  const common: Konva.LineConfig = { points: pts, lineCap: 'round', lineJoin: 'round', strokeScaleEnabled: false };
  if (kind === 'line') return init(new Konva.Line(common), kind, s);
  if (kind === 'arrow') return init(attachArrowShape(new Konva.Line(common)), kind, s);
  return init(new Konva.Arrow({ ...common, tension: 0.5 }), kind, s);
}

export function newStroke(kind: 'pen' | 'highlighter', pts: number[], s: Style) {
  return init(
    new Konva.Line({ points: pts, tension: kind === 'pen' ? 0.35 : 0, lineCap: kind === 'pen' ? 'round' : 'butt', lineJoin: 'round', strokeScaleEnabled: false }),
    kind,
    s,
  );
}

export function newShape(kind: 'rect' | 'ellipse', r: Rect, s: Style) {
  if (kind === 'rect') return init(new Konva.Rect({ x: r.x, y: r.y, width: r.w, height: r.h, strokeScaleEnabled: false }), kind, s);
  return init(
    new Konva.Ellipse({ x: r.x + r.w / 2, y: r.y + r.h / 2, radiusX: r.w / 2, radiusY: r.h / 2, strokeScaleEnabled: false }),
    kind,
    s,
  );
}

export function newLabel(kind: 'text' | 'callout', p: Vec, s: Style, text: string) {
  const label = new Konva.Label({ x: p.x, y: p.y });
  label.add(
    new Konva.Tag(
      kind === 'callout'
        ? { pointerDirection: 'down', pointerWidth: 16, pointerHeight: 16, cornerRadius: 6, lineJoin: 'round' }
        : {},
    ),
  );
  label.add(new Konva.Text({ text, fontFamily: FONT, padding: kind === 'callout' ? 10 : 6, lineHeight: 1.2 }));
  init(label, kind, s);
  if (kind === 'callout') {
    // The tail tip sits at the click point.
    label.position({ x: p.x - label.width() / 2, y: p.y - label.height() - 16 });
  }
  return label;
}

export function newStep(p: Vec, s: Style, n: number) {
  const g = new Konva.Group({ x: p.x, y: p.y });
  g.add(new Konva.Circle({}));
  g.add(new Konva.Text({ text: String(n), fontFamily: FONT, fontStyle: 'bold', align: 'center', verticalAlign: 'middle' }));
  return init(g, 'step', s);
}

export function newEmoji(p: Vec, s: Style, char: string) {
  const t = new Konva.Text({ text: char, fontFamily: EMOJI_FONT });
  const node = init(t, 'emoji', s);
  node.position(p);
  return node;
}

/** Dims everything except the node's own rectangle. */
export function newSpotlight(r: Rect, s: Style, view: () => View) {
  const shape = new Konva.Shape({
    x: r.x, y: r.y, width: r.w, height: r.h,
    sceneFunc(ctx, self) {
      const v = view();
      // Map the canvas corners into this node's local space so moving/resizing keeps the whole image dimmed.
      const inv = self.getAbsoluteTransform().copy().invert();
      const pts = [[0, 0], [v.width * v.zoom, 0], [v.width * v.zoom, v.height * v.zoom], [0, v.height * v.zoom]].map(([x, y]) => inv.point({ x, y }));
      const c = ctx._context;
      c.beginPath();
      c.moveTo(pts[0].x, pts[0].y);
      for (const q of pts.slice(1)) c.lineTo(q.x, q.y);
      c.closePath();
      c.rect(0, 0, self.width(), self.height());
      c.fillStyle = `rgba(0,0,0,${self.getAttr('dim') ?? 0.6})`;
      c.fill('evenodd');
    },
    hitFunc(ctx, self) {
      ctx.beginPath();
      ctx.rect(0, 0, self.width(), self.height());
      ctx.closePath();
      ctx.fillStrokeShape(self);
    },
    fill: '#000',
  });
  return init(shape, 'spotlight', s);
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Pixelated or blurred copy of a region of the base image. */
export function renderObscured(base: HTMLCanvasElement, r: Rect, s: Style): HTMLCanvasElement {
  const w = Math.max(1, Math.round(r.w)), h = Math.max(1, Math.round(r.h));
  const x = Math.round(r.x), y = Math.round(r.y);
  const out = makeCanvas(w, h);
  const ctx = out.getContext('2d')!;
  // Source rect clipped to the image, drawn at the matching offset.
  const sx = Math.max(0, x), sy = Math.max(0, y);
  const sw = Math.min(base.width, x + w) - sx, sh = Math.min(base.height, y + h) - sy;
  if (sw <= 0 || sh <= 0) return out;

  if (s.mode === 'pixelate') {
    const px = Math.max(3, Math.round(s.width * 2));
    const small = makeCanvas(Math.ceil(w / px), Math.ceil(h / px));
    const sctx = small.getContext('2d')!;
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(base, sx, sy, sw, sh, sx - x > 0 ? (sx - x) / px : 0, sy - y > 0 ? (sy - y) / px : 0, sw / px, sh / px);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, small.width, small.height, 0, 0, small.width * px, small.height * px);
  } else {
    const radius = Math.max(2, s.width * 1.5);
    const pad = Math.ceil(radius * 3);
    const tmp = makeCanvas(w + pad * 2, h + pad * 2);
    const tctx = tmp.getContext('2d')!;
    // Pad with real surrounding pixels so edges blur into the image, not into transparency.
    const px0 = Math.max(0, x - pad), py0 = Math.max(0, y - pad);
    const px1 = Math.min(base.width, x + w + pad), py1 = Math.min(base.height, y + h + pad);
    tctx.drawImage(base, px0, py0, px1 - px0, py1 - py0, px0 - (x - pad), py0 - (y - pad), px1 - px0, py1 - py0);
    ctx.filter = `blur(${radius}px)`;
    ctx.drawImage(tmp, -pad, -pad);
  }
  return out;
}

export function newBlur(base: HTMLCanvasElement, r: Rect, s: Style) {
  const img = new Konva.Image({
    x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.w), height: Math.round(r.h),
    image: renderObscured(base, r, s),
  });
  return init(img, 'blur', s);
}

/** Re-sample the image under a blur node after it moved, resized or its style changed. */
export function refreshBlur(node: Konva.Image, base: HTMLCanvasElement) {
  node.image(renderObscured(base, { x: node.x(), y: node.y(), w: node.width(), h: node.height() }, styleOf(node)));
}
