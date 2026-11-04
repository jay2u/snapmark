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

/**
 * Tapered arrow along a curve through three points: start, a point ON the curve (the middle
 * handle), and end. Same look as arrowPolygon: thin tail, swelling body, swept-back head.
 */
export function curvedArrowPolygon(pts: number[], width: number): Vec[] {
  if (pts.length < 6) return arrowPolygon(pts, width);
  const S = { x: pts[0], y: pts[1] }, M = { x: pts[2], y: pts[3] }, E = { x: pts[4], y: pts[5] };
  // Quadratic Bezier that passes through M at t = 0.5.
  const C = { x: 2 * M.x - (S.x + E.x) / 2, y: 2 * M.y - (S.y + E.y) / 2 };
  const N = 48;
  const samples: { p: Vec; t: Vec; s: number }[] = [];
  let len = 0;
  for (let i = 0; i <= N; i++) {
    const u = i / N, v = 1 - u;
    const p = { x: v * v * S.x + 2 * v * u * C.x + u * u * E.x, y: v * v * S.y + 2 * v * u * C.y + u * u * E.y };
    const d = { x: 2 * v * (C.x - S.x) + 2 * u * (E.x - C.x), y: 2 * v * (C.y - S.y) + 2 * u * (E.y - C.y) };
    const dl = Math.hypot(d.x, d.y) || 1;
    if (i > 0) len += Math.hypot(p.x - samples[i - 1].p.x, p.y - samples[i - 1].p.y);
    samples.push({ p, t: { x: d.x / dl, y: d.y / dl }, s: len });
  }
  if (len < 1) return [];

  const f = width / 4;
  const headLen = Math.min(len * 0.55, (14 + len * 0.14) * f);
  const headHalf = headLen * 0.6;
  const bodyHalf = headHalf * 0.4;
  const tailHalf = Math.max(0.6, bodyHalf * 0.1);
  const neck = len - headLen;
  const barb = Math.max(0, neck - headLen * 0.18);

  /** Position and unit normal at arc length s. */
  const at = (s: number) => {
    let i = 1;
    while (i < samples.length - 1 && samples[i].s < s) i++;
    const a = samples[i - 1], b = samples[i];
    const k = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
    const t = { x: a.t.x + (b.t.x - a.t.x) * k, y: a.t.y + (b.t.y - a.t.y) * k };
    const tl = Math.hypot(t.x, t.y) || 1;
    return { p: { x: a.p.x + (b.p.x - a.p.x) * k, y: a.p.y + (b.p.y - a.p.y) * k }, n: { x: -t.y / tl, y: t.x / tl } };
  };
  const side = (s: number, half: number, sign: 1 | -1): Vec => {
    const { p, n } = at(s);
    return { x: p.x + n.x * half * sign, y: p.y + n.y * half * sign };
  };

  const ss = samples.map((q) => q.s).filter((s) => s < neck);
  ss.push(neck);
  const half = (s: number) => tailHalf + (bodyHalf - tailHalf) * (s / neck);
  return [
    ...ss.map((s) => side(s, half(s), 1)),
    side(barb, headHalf, 1),
    E,
    side(barb, headHalf, -1),
    ...ss.map((s) => side(s, half(s), -1)).reverse(),
  ];
}
