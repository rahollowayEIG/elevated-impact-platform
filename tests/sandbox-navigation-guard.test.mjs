import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedSandboxDestination, installSandboxNavigationGuard } from '../src/sandbox/sandboxNavigationGuard.mjs';

const base = 'https://elevationpilot-sandbox.example/sandbox';
test('allows internal navigation without requiring an external host', () => {
  for (const value of ['/', '/airport', '#team', '?tab=main', 'https://elevationpilot-sandbox.example/events']) {
    assert.equal(isAllowedSandboxDestination(value, base), true);
  }
});
test('blocks live app domains and external communications', () => {
  for (const value of [
    'https://golf.elevatedimpactgroup.net/register',
    'https://elevated-impact-platform.vercel.app',
    'https://golf-event-registrations-eig.vercel.app',
    'mailto:real@example.com', 'tel:+15550001111', 'javascript:alert(1)',
    'data:text/html,blocked', 'https://evil.example/'
  ]) assert.equal(isAllowedSandboxDestination(value, base), false);
});
test('production mode leaves navigation unmodified', () => {
  const cleanup = installSandboxNavigationGuard({ enabled: false });
  assert.equal(typeof cleanup, 'function');
  cleanup();
});
