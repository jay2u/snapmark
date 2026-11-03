import type { Rect, Vec } from './types';

/** Snap `to` so the segment from `from` is a multiple of 45 degrees. */
export function snap45(from: Vec, to: Vec): Vec {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return { x: from.x + Math.cos(a) * len, y: from.y + Math.sin(a) * len };
}

export function rectFrom(a: Vec, b: Vec, square = false): Rect {
  let w = b.x - a.x, h = b.y - a.y;
  if (square) {
    const m = Math.max(Math.abs(w), Math.abs(h));
    w = Math.sign(w || 1) * m;
    h = Math.sign(h || 1) * m;
  }
  return { x: Math.min(a.x, a.x + w), y: Math.min(a.y, a.y + h), w: Math.abs(w), h: Math.abs(h) };
}

/**
 * Outline of a tapered "brush" arrow from (x1,y1) to (x2,y2): a thin tail that swells towards
 * a swept-back head. Everything scales with the arrow's length, so long arrows are bolder.
 * `width` is the Size option (4 = default).
 */
export function arrowPolygon(pts: number[], width: number): Vec[] {
  const [x1, y1, x2, y2] = [pts[0], pts[1], pts[pts.length - 2], pts[pts.length - 1]];
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return [];
  const f = width / 4;
  const ux = dx / len, uy = dy / len; // along the arrow
  const nx = -uy, ny = ux; // across it
  const headLen = Math.min(len * 0.55, (14 + len * 0.14) * f);
  const headHalf = headLen * 0.6;
  const bodyHalf = headHalf * 0.4;
  const tailHalf = Math.max(0.6, bodyHalf * 0.1);
  const at = (along: number, across: number): Vec => ({
    x: x1 + ux * along + nx * across,
    y: y1 + uy * along + ny * across,
  });
  const neck = len - headLen;
  const barb = neck - headLen * 0.18; // barbs sweep back behind the neck
  return [
    at(0, tailHalf),
    at(neck, bodyHalf),
    at(barb, headHalf),
    at(len, 0),
    at(barb, -headHalf),
    at(neck, -bodyHalf),
    at(0, -tailHalf),
  ];
}
