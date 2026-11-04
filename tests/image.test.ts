import { describe, expect, it } from 'vitest';
import { MAX_CANVAS_AREA, limitScale, nextScrollY } from '../src/shared/image';
import { rectFrom, snap45 } from '../src/editor/geometry';

describe('nextScrollY', () => {
  it('steps one viewport at a time and clamps the last slice to the page end', () => {
    expect(nextScrollY(0, 1000, 2500)).toBe(1000);
    expect(nextScrollY(1000, 1000, 2500)).toBe(1500);
    expect(nextScrollY(1500, 1000, 2500)).toBeNull();
  });
  it('is done after one slice when the page fits', () => {
    expect(nextScrollY(0, 1000, 800)).toBeNull();
  });
  it('finishes on an exact multiple without a duplicate slice', () => {
    expect(nextScrollY(2000, 1000, 3000)).toBeNull();
  });
  it('stops at the height cap for endless pages', () => {
    expect(nextScrollY(29_500, 1000, 1_000_000)).toBeNull();
    expect(nextScrollY(1000, 1000, 1_000_000)).toBe(2000);
  });
});

describe('limitScale', () => {
  it('leaves normal images alone', () => expect(limitScale(1920, 5000)).toBe(1));
  it('shrinks over-tall images below the dimension cap', () => {
    const k = limitScale(1440, 100_000);
    expect(100_000 * k).toBeLessThanOrEqual(32000);
  });
  it('shrinks images over the area cap', () => {
    const k = limitScale(30_000, 30_000);
    expect(30_000 * 30_000 * k * k).toBeLessThanOrEqual(MAX_CANVAS_AREA + 1);
  });
});

describe('geometry', () => {
  it('normalises a rectangle dragged up and to the left', () => {
    expect(rectFrom({ x: 50, y: 50 }, { x: 10, y: 20 })).toEqual({ x: 10, y: 20, w: 40, h: 30 });
  });
  it('makes squares on request', () => {
    expect(rectFrom({ x: 0, y: 0 }, { x: 40, y: 10 }, true)).toEqual({ x: 0, y: 0, w: 40, h: 40 });
  });
  it('snaps lines to 45 degree steps', () => {
    const p = snap45({ x: 0, y: 0 }, { x: 100, y: 10 });
    expect(p.y).toBeCloseTo(0);
    expect(p.x).toBeCloseTo(Math.hypot(100, 10));
  });
});

import { arrowPolygon, curvedArrowPolygon } from '../src/editor/geometry';

describe('arrowPolygon', () => {
  it('ends in a point exactly at the target', () => {
    const poly = arrowPolygon([0, 0, 200, 0], 4);
    expect(poly[3]).toEqual({ x: 200, y: 0 });
  });
  it('is thin at the tail and widest at the head', () => {
    const poly = arrowPolygon([0, 0, 200, 0], 4);
    const tail = Math.abs(poly[0].y), body = Math.abs(poly[1].y), head = Math.abs(poly[2].y);
    expect(tail).toBeLessThan(body);
    expect(body).toBeLessThan(head);
  });
  it('grows with length and with the Size option', () => {
    const w = (pts: number[], size = 4) => Math.abs(arrowPolygon(pts, size)[2].y);
    expect(w([0, 0, 400, 0])).toBeGreaterThan(w([0, 0, 100, 0]));
    expect(w([0, 0, 200, 0], 8)).toBeGreaterThan(w([0, 0, 200, 0], 4));
  });
  it('keeps the head inside very short arrows and ignores zero length', () => {
    expect(arrowPolygon([5, 5, 5, 5], 4)).toEqual([]);
    const poly = arrowPolygon([0, 0, 20, 0], 4);
    expect(Math.min(...poly.map((p) => p.x))).toBeGreaterThanOrEqual(-0.001);
  });
});

describe('curvedArrowPolygon', () => {
  const pts = [0, 0, 100, -60, 200, 0]; // bulges upward through (100, -60)
  it('ends in a point at the target', () => {
    const poly = curvedArrowPolygon(pts, 4);
    expect(poly).toContainEqual({ x: 200, y: 0 });
  });
  it('follows the bend: passes through the middle handle', () => {
    const poly = curvedArrowPolygon(pts, 4);
    const nearest = Math.min(...poly.map((p) => Math.hypot(p.x - 100, p.y + 60)));
    expect(nearest).toBeLessThan(8); // within the body half-width of the handle
  });
  it('is thin at the tail and wider further along', () => {
    const poly = curvedArrowPolygon(pts, 4);
    const half = poly.length;
    const gap = (i: number) => Math.hypot(poly[i].x - poly[half - 1 - i].x, poly[i].y - poly[half - 1 - i].y);
    expect(gap(0)).toBeLessThan(gap(5));
  });
  it('grows with length', () => {
    const big = curvedArrowPolygon([0, 0, 200, -120, 400, 0], 4);
    const small = curvedArrowPolygon([0, 0, 50, -30, 100, 0], 4);
    const spread = (poly: { x: number; y: number }[]) => Math.max(...poly.map((p) => p.y)) - Math.min(...poly.map((p) => p.y));
    expect(spread(big)).toBeGreaterThan(spread(small) * 2);
  });
  it('handles a degenerate arrow', () => {
    expect(curvedArrowPolygon([5, 5, 5, 5, 5, 5], 4)).toEqual([]);
  });
});
