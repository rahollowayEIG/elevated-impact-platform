#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const variant = process.argv[2];
if (!['live','sandbox'].includes(variant)) throw new Error('Expected live or sandbox build variant');
const rendered = readFileSync('dist/index.html','utf8');
const manifest = JSON.parse(readFileSync('dist/pwa/' + variant + '.webmanifest','utf8'));
const appName = variant === 'live' ? 'ElevationPilot' : 'ElevationPilot Sandbox';

assert.ok(rendered.includes('<title>' + appName + '</title>'));
assert.ok(rendered.includes('href="/pwa/' + variant + '.webmanifest"'));
assert.equal((rendered.match(/rel="manifest"/g) || []).length, 1);
assert.equal(manifest.name,appName);
assert.equal(manifest.display,'standalone');
for (const { src, sizes } of manifest.icons) {
  const bytes = readFileSync('dist' + src);
  const width = parseInt(sizes.split('x')[0],10);
  assert.equal(bytes.readUInt32BE(16),width);
  assert.equal(bytes.readUInt32BE(20),width);
}
console.log('Verified ' + variant + ' PWA production bundle: install identity, manifest, titles and icon files.');
