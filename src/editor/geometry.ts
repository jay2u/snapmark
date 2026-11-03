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
