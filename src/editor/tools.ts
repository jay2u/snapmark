import Konva from 'konva';
import type { Editor } from './editor';
import { newEmoji, newLabel, newLine, newShape, newStep, newStroke } from './nodes';
import { rectFrom, snap45 } from './geometry';
import type { Kind, Rect, ToolId, Vec } from './types';

type Ev = { shiftKey?: boolean };

export interface Tool {
  down(p: Vec, e: Ev, target?: Konva.Node): void;
  move(p: Vec, e: Ev): void;
  up(p: Vec, e: Ev): void;
  cancel?(): void;
}

const MIN_DRAG = 4;

/** Click-and-drag between two points, creating a node on press and updating it while dragging. */
function dragTool<N extends Konva.Node>(
  ed: Editor,
  create: (a: Vec) => N,
  update: (node: N, a: Vec, b: Vec, e: Ev) => void,
  isValid: (a: Vec, b: Vec) => boolean = (a, b) => Math.hypot(b.x - a.x, b.y - a.y) >= MIN_DRAG,
): Tool {
  let node: N | null = null;
  let start: Vec = { x: 0, y: 0 };
  const abort = () => { node?.destroy(); node = null; };
  return {
    down(p) {
      start = p;
      node = create(p);
      ed.add(node);
    },
    move(p, e) {
      if (!node) return;
      update(node, start, p, e);
      ed.annLayer.batchDraw();
    },
    up(p, e) {
      if (!node) return;
      update(node, start, p, e);
      if (isValid(start, p)) {
        node = null;
        ed.commit();
      } else abort();
      ed.annLayer.batchDraw();
    },
    cancel: abort,
  };
}

/** A tool that draws a dashed marquee and reports the rectangle when released. */
function marqueeTool(ed: Editor, onDone: (r: Rect) => void, square = false): Tool {
  let box: Konva.Rect | null = null;
  let start: Vec = { x: 0, y: 0 };
  const remove = () => { box?.destroy(); box = null; ed.uiLayer.batchDraw(); };
  return {
    down(p) {
      start = p;
      box = new Konva.Rect({ x: p.x, y: p.y, stroke: '#4f8cff', strokeWidth: 1.5, dash: [6, 4], fill: 'rgba(79,140,255,0.12)', strokeScaleEnabled: false, listening: false });
      ed.uiLayer.add(box);
    },
    move(p, e) {
      if (!box) return;
      box.setAttrs(toAttrs(rectFrom(start, p, square && !!e.shiftKey)));
      ed.uiLayer.batchDraw();
    },
    up(p, e) {
      if (!box) return;
      const r = rectFrom(start, p, square && !!e.shiftKey);
      remove();
      if (r.w >= MIN_DRAG && r.h >= MIN_DRAG) onDone(r);
    },
    cancel: remove,
  };
}
const toAttrs = (r: Rect) => ({ x: r.x, y: r.y, width: r.w, height: r.h });

export function createTools(ed: Editor): Record<ToolId, Tool> {
  const style = (k: Kind) => ({ ...ed.styles[k] });

  // --- select -------------------------------------------------------------
  const select: Tool = {
    down(_p, e, target) {
      if (!target || target.getLayer() === ed.uiLayer) return; // transformer / handles manage themselves
      const node = target.getLayer() === ed.annLayer ? ed.topLevel(target) : null;
      if (!node) {
        ed.clearSelection();
        return;
      }
      if (e.shiftKey) {
        const has = ed.selection.includes(node);
        ed.select(has ? ed.selection.filter((n) => n !== node) : [...ed.selection, node]);
      } else if (!ed.selection.includes(node)) ed.select([node]);
    },
    move() {},
    up() {},
  };

  // --- lines & arrows -------------------------------------------------------
  const lineTool = (kind: 'arrow' | 'line') =>
    dragTool<Konva.Line>(
      ed,
      (a) => newLine(kind, [a.x, a.y, a.x, a.y], style(kind)),
      (n, a, b, e) => {
        const end = e.shiftKey ? snap45(a, b) : b;
        n.points([a.x, a.y, end.x, end.y]);
      },
    );

  const curve = dragTool<Konva.Line>(
    ed,
    (a) => newLine('curve', [a.x, a.y, a.x, a.y, a.x, a.y], style('curve')),
    (n, a, b) => {
      // Control point bulges to one side of the straight line.
      const dx = b.x - a.x, dy = b.y - a.y;
      n.points([a.x, a.y, (a.x + b.x) / 2 - dy * 0.25, (a.y + b.y) / 2 + dx * 0.25, b.x, b.y]);
    },
  );

  // --- shapes ---------------------------------------------------------------
  const shapeTool = (kind: 'rect' | 'ellipse') =>
    dragTool<Konva.Shape>(
      ed,
      (a) => newShape(kind, { x: a.x, y: a.y, w: 1, h: 1 }, style(kind)),
      (n, a, b, e) => {
        const r = rectFrom(a, b, !!e.shiftKey);
        if (kind === 'rect') n.setAttrs(toAttrs(r));
        else n.setAttrs({ x: r.x + r.w / 2, y: r.y + r.h / 2, radiusX: r.w / 2, radiusY: r.h / 2 });
      },
    );

  // --- freehand -------------------------------------------------------------
  const strokeTool = (kind: 'pen' | 'highlighter') => {
    const t = dragTool<Konva.Line>(
      ed,
      (a) => newStroke(kind, [a.x, a.y, a.x, a.y], style(kind)),
      (n, a, b, e) => {
        if (kind === 'highlighter' && e.shiftKey) {
          n.setAttr('tension', 0);
          n.points([a.x, a.y, b.x, b.y]); // straight highlight
        } else n.points([...n.points(), b.x, b.y]);
      },
      () => true,
    );
    return t;
  };

  // --- text / callout -------------------------------------------------------
  const labelTool = (kind: 'text' | 'callout'): Tool => ({
    down(p) {
      const label = newLabel(kind, p, style(kind), kind === 'text' ? 'Text' : 'Note');
      label.setAttr('snapNew', true);
      ed.add(label);
      ed.annLayer.draw();
      // Edit immediately; the label stays a plain draft until the user confirms.
      ed.editText(label);
    },
    move() {},
    up() {},
  });

  // --- stamps ---------------------------------------------------------------
  const step: Tool = {
    down(p) {
      ed.add(newStep(p, style('step'), ed.nextStepNumber()));
      ed.commit();
    },
    move() {},
    up() {},
  };
  const emoji: Tool = {
    down(p) {
      ed.add(newEmoji(p, style('emoji'), ed.emoji));
      ed.commit();
    },
    move() {},
    up() {},
  };

  // --- obscure / focus / crop ----------------------------------------------
  const blur = marqueeTool(ed, (r) => {
    ed.add(ed.newBlur(r, style('blur')));
    ed.commit();
  });
  const spotlight = marqueeTool(ed, (r) => {
    ed.add(ed.newSpotlight(r, style('spotlight')));
    ed.commit();
  });
  const crop = marqueeTool(ed, (r) => ed.crop(r));

  return {
    select,
    arrow: lineTool('arrow'),
    curve,
    line: lineTool('line'),
    rect: shapeTool('rect'),
    ellipse: shapeTool('ellipse'),
    pen: strokeTool('pen'),
    highlighter: strokeTool('highlighter'),
    text: labelTool('text'),
    callout: labelTool('callout'),
    step,
    emoji,
    blur,
    spotlight,
    crop,
  } satisfies Record<ToolId, Tool>;
}

