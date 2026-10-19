import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getSandboxBranding } from '../src/sandbox/sandboxBranding.mjs';

test('sandbox is clearly named in the page title, header and persistent indicator', () => {
  const branding = getSandboxBranding(true);
  assert.equal(branding.pageTitle, 'SANDBOX | ElevationPilot');
  assert.equal(branding.homeSubtitle, 'ElevationPilot Sandbox');
  assert.equal(branding.badgeLabel, 'SANDBOX');
  assert.match(branding.badgeDetail, /Practice environment/);
});

test('production has no sandbox branding', () => {
  assert.equal(getSandboxBranding(false), null);
  assert.equal(getSandboxBranding(undefined), null);
});

test('global app shell keeps Sandbox labeling in the header without redundant floating corner badge', () => {
  const source = readFileSync('src/main.jsx', 'utf8');
  assert.match(source, /VITE_ELEVATIONPILOT_SANDBOX === 'true'/);
  assert.match(source, /const sandboxBranding = getSandboxBranding\(IS_SANDBOX\)/);
  assert.match(source, /if \(sandboxBranding\) document\.title = sandboxBranding\.pageTitle/);
  assert.match(source, /className="eig-sandbox-mode-label"/);
  assert.match(source, /title="Training and demonstrations only"/);
  assert.match(source, /\{sandboxBranding && <small className="eig-global-home-subtitle"/);
  assert.doesNotMatch(source, /data-testid="sandbox-environment-indicator"|className="eig-sandbox-indicator"|position:fixed;left:12px/);
  assert.match(source, /<ElevatedImpactPhaseOneFrontend \/>/);
});
