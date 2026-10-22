#!/usr/bin/env node
/**
 * Deterministically generate basic, dependency-free PNG install icons.
 * Art direction: EIG navy with white E, red P. The sandbox adds a gold frame.
 * These are provisional vector-inspired icons; approved branding may replace
 * them without changing the two separated manifests/installation identities.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const out = resolve(fileURLToPath(new URL('../public/pwa/', import.meta.url)));
const NAVY = [29, 36, 93];
const RED = [216, 28, 34];
const WHITE = [255, 255, 255];
const GOLD = [235, 187, 76];
const TRANSPARENT = [0, 0, 0, 0];

function rounded(x, y, x0, y0, x1, y1, radius) {
  const cx = Math.min(x1 - radius, Math.max(x0 + radius, x));
  const cy = Math.min(y1 - radius, Math.max(y0 + radius, y));
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}
function stroke(x, y, x1, y1, x2, y2, thickness) {
  const vx = x2 - x1, vy = y2 - y1;
  const len2 = vx * vx + vy * vy;
  const t = len2 ? Math.min(1, Math.max(0, ((x - x1) * vx + (y - y1) * vy) / len2)) : 0;
  const dx = x - (x1 + vx * t), dy = y - (y1 + vy * t);
  return dx * dx + dy * dy <= thickness * thickness / 4;
}
function sample(x, y, sandbox) {
  if (!rounded(x, y, .01, .01, .99, .99, .19)) return TRANSPARENT;
  if (sandbox && !rounded(x, y, .063, .063, .937, .937, .159)) return GOLD;
  const e = [
    [.282,.31,.282,.70], [.282,.31,.453,.31],
    [.282,.506,.433,.506], [.282,.70,.453,.70],
  ];
  if (e.some(([x1,y1,x2,y2]) => stroke(x,y,x1,y1,x2,y2,.060))) return WHITE;
  const p = [
    [.565,.31,.565,.70], [.565,.31,.687,.31],
    [.687,.31,.733,.350], [.733,.350,.733,.440],
    [.733,.440,.685,.492], [.685,.492,.565,.492],
  ];
  if (p.some(([x1,y1,x2,y2]) => stroke(x,y,x1,y1,x2,y2,.063))) return RED;
  if (sandbox && (x - .754) ** 2 + (y - .716) ** 2 < .032 ** 2) return GOLD;
  return NAVY;
}
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const kind = Buffer.from(name, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const check = Buffer.alloc(4);
  check.writeUInt32BE(crc32(Buffer.concat([kind, data])));
  return Buffer.concat([len, kind, data, check]);
}
function png(size, sandbox) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  const sampleCount = 4;
  for (let y = 0; y < size; y++) {
    const offset = y * (1 + size * 4);
    raw[offset] = 0;
    for (let x = 0; x < size; x++) {
      const rgba = [0, 0, 0, 0];
      for (const sy of [.25, .75]) for (const sx of [.25, .75]) {
        const color = sample((x + sx) / size, (y + sy) / size, sandbox);
        const a = color.length === 4 ? color[3] / 255 : 1;
        rgba[0] += color[0] * a;
        rgba[1] += color[1] * a;
        rgba[2] += color[2] * a;
        rgba[3] += a * 255;
      }
      const p = offset + 1 + x * 4;
      const alpha = rgba[3] / (255 * sampleCount);
      raw[p] = alpha ? Math.round(rgba[0] / sampleCount / alpha) : 0;
      raw[p+1] = alpha ? Math.round(rgba[1] / sampleCount / alpha) : 0;
      raw[p+2] = alpha ? Math.round(rgba[2] / sampleCount / alpha) : 0;
      raw[p+3] = Math.round(rgba[3] / sampleCount);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8-bit components
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
await mkdir(out, { recursive: true });
for (const kind of ['live', 'sandbox']) for (const size of [192, 512]) {
  await writeFile(resolve(out, kind + '-' + size + '.png'), png(size, kind === 'sandbox'));
}
console.log('Generated four isolated PWA icons (192px and 512px; Live and Sandbox).');
