import Konva from 'konva';
import { attachArrowShape, kindOf, newBlur, newSpotlight, styleOf, type View } from './nodes';

interface Ctx {
  base: () => HTMLCanvasElement;
  view: () => View;
}

export function serialize(node: Konva.Node): string {
  const kind = kindOf(node);
  if (kind === 'blur' || kind === 'spotlight') {
    return JSON.stringify({ kind, x: node.x(), y: node.y(), w: node.width(), h: node.height(), style: styleOf(node) });
  }
  return JSON.stringify({ kind: 'konva', json: node.toJSON() });
}

export function deserialize(str: string, ctx: Ctx): Konva.Node {
  const o = JSON.parse(str);
  if (o.kind === 'blur') return newBlur(ctx.base(), { x: o.x, y: o.y, w: o.w, h: o.h }, o.style);
  if (o.kind === 'spotlight') return newSpotlight({ x: o.x, y: o.y, w: o.w, h: o.h }, o.style, ctx.view);
  const node = Konva.Node.create(o.json);
  node.draggable(true);
  if (kindOf(node) === 'arrow' || kindOf(node) === 'curve') attachArrowShape(node as Konva.Line);
  return node;
}
