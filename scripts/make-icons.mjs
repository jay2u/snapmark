// Generates the extension icons (pure Node, no dependencies).
import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size);
      raw.set([r, g, b, a], y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Coverage (0..1) of the icon design at a point in unit space.
function sample(u, v) {
  // rounded square background
  const r = 0.22;
  const dx = Math.max(Math.abs(u - 0.5) - (0.5 - r), 0);
  const dy = Math.max(Math.abs(v - 0.5) - (0.5 - r), 0);
  if (dx * dx + dy * dy > r * r) return null;
  // gradient blue -> violet
  const t = (u + v) / 2;
  let col = [37 + 100 * t, 99 - 20 * t, 235 - 10 * t];
  // white viewfinder corners
  const m = 0.2, L = 0.2, th = 0.07;
  const inCorner = (cx, cy) => {
    const ax = Math.abs(u - cx), ay = Math.abs(v - cy);
    return (ax < L && ay < th) || (ay < L && ax < th);
  };
  const corners = [
    [m, m], [1 - m, m], [m, 1 - m], [1 - m, 1 - m],
  ];
  const cornerHit = corners.some(([cx, cy]) => {
    const sx = cx < 0.5 ? 1 : -1, sy = cy < 0.5 ? 1 : -1;
    const lx = (u - cx) * sx, ly = (v - cy) * sy;
    return (lx >= -th && lx <= L && ly >= -th && ly <= th) || (ly >= -th && ly <= L && lx >= -th && lx <= th);
  });
  const dot = Math.hypot(u - 0.5, v - 0.5) < 0.12;
  if (cornerHit || dot) col = [255, 255, 255];
  return col;
}

for (const size of [16, 32, 48, 128]) {
  const SS = 3;
  const data = png(size, (x, y) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let sy = 0; sy < SS; sy++)
      for (let sx = 0; sx < SS; sx++) {
        const c = sample((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
        if (c) { r += c[0]; g += c[1]; b += c[2]; n++; }
      }
    if (!n) return [0, 0, 0, 0];
    return [r / n, g / n, b / n, (n / (SS * SS)) * 255].map(Math.round);
  });
  writeFileSync(new URL(`${size}.png`, out), data);
}
console.log('icons written');
