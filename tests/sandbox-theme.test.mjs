import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appShell = readFileSync('src/main.jsx', 'utf8');
const theme = readFileSync('src/sandbox/sandboxTheme.css', 'utf8');
const cssNoComments = theme.replace(/\/\*[\s\S]*?\*\//g, '');

test('pink sandbox paint is applied only after the sandbox Supabase guard', () => {
  const guard = appShell.indexOf('assertSandboxSupabaseTarget(');
  const enable = appShell.indexOf("if (IS_SANDBOX) document.documentElement.classList.add('elevationpilot-sandbox');");
  assert.ok(guard >= 0 && enable > guard, 'Must verify backend before marking any app as a sandbox');
  assert.match(appShell, /import '\.\/sandbox\/sandboxTheme\.css'/);
  assert.match(appShell, /VITE_ELEVATIONPILOT_SANDBOX === 'true'/);
});

test('all sandbox visual rules require the sandbox-only document class', () => {
  const normalized = cssNoComments.replace(/@media[^{}]*\{/g, '');
  const selectors = [...normalized.matchAll(/(?:^|\})\s*([^{}]+)\{/g)].map(x => x[1].trim());
  assert.ok(selectors.length >= 12, 'Expected visible theming across major page types');
  for (const rule of selectors) {
    // Ignore commas belonging to CSS functional pseudo-classes such as :is().
    for (const selector of rule.split(/,(?![^()]*\))/)) {
      assert.ok(selector.trim().startsWith('html.elevationpilot-sandbox'), 'Unscoped sandbox selector: ' + selector);
    }
  }
  assert.match(theme, /#f43194/i);
  assert.match(theme, /\.eig-global-header/);
  assert.match(theme, /\.eig-sandbox-mode-label/);
  assert.doesNotMatch(theme, /\.eig-sandbox-indicator/);
  assert.match(theme, /\.platform-auth-screen/);
  assert.match(theme, /\.platform-shell/);
  assert.match(theme, /\.airport-hero/);
  assert.match(theme, /\.cockpit-flightdeck/);
});

test('visual theme cannot change backend authorization or point at real systems', () => {
  assert.doesNotMatch(cssNoComments, /supabase|jwt|access_token|refresh_token|service_role/i);
});
