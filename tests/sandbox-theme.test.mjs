import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appShell = readFileSync('src/main.jsx', 'utf8');
const theme = readFileSync('src/sandbox/sandboxTheme.css', 'utf8');

test('pink sandbox paint is applied only after the sandbox Supabase guard', () => {
  const guard = appShell.indexOf('assertSandboxSupabaseTarget(');
  const enable = appShell.indexOf("if (IS_SANDBOX) document.documentElement.classList.add('elevationpilot-sandbox');");
  assert.ok(guard >= 0 && enable > guard, 'Must verify backend before marking any app as a sandbox');
  assert.match(appShell, /import '\.\/sandbox\/sandboxTheme\.css'/);
  assert.match(appShell, /VITE_ELEVATIONPILOT_SANDBOX === 'true'/);
  assert.doesNotMatch(appShell, /document\.documentElement\.classList\.add\('elevationpilot-sandbox'\);\s*assertSandboxSupabaseTarget/);
});

test('all sandbox visual rules require the sandbox-only document class', () => {
  const source = theme.replace(/\/\*[\s\S]*?\*\//g, '');
  const normalized = source.replace(/@media[^{}]*\{/g, '');
  const selectors = [...normalized.matchAll(/(?:^|\})\s*([^{}]+)\{/g)].map(x => x[1].trim());
  assert.ok(selectors.length >= 12, 'Expected visible theming across major page types');
  for (const rule of selectors) {
    for (const selector of rule.split(',')) {
      assert.ok(selector.trim().startsWith('html.elevationpilot-sandbox'), 'Unscoped sandbox selector: ' + selector);
    }
  }
  assert.match(theme, /#f43194/i);
  assert.match(theme, /\.eig-global-header/);
  assert.match(theme, /\.eig-sandbox-indicator/);
  assert.match(theme, /\.platform-auth-screen/);
  assert.match(theme, /\.platform-shell/);
  assert.match(theme, /\.airport-hero/);
  assert.match(theme, /\.cockpit-flightdeck/);
});

test('the role simulator cannot change access by changing the visual theme', () => {
  assert.doesNotMatch(theme, /supabase|jwt|access_token|refresh_token|service_role/i);
});
