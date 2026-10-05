import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const files = {
  platform: await readFile(new URL('../src/PlatformApp.jsx', import.meta.url), 'utf8'),
  recovery: await readFile(new URL('../src/auth/RecoveryScreen.jsx', import.meta.url), 'utf8'),
  postRecovery: await readFile(new URL('../src/auth/PostRecoverySignIn.jsx', import.meta.url), 'utf8'),
  field: await readFile(new URL('../src/components/PasswordField.jsx', import.meta.url), 'utf8'),
  styles: await readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
};

test('active platform authentication forms use the shared password visibility control', () => {
  assert.equal((files.platform.match(/<PasswordField/g) || []).length, 7);
  assert.equal((files.recovery.match(/<PasswordField/g) || []).length, 2);
  assert.equal((files.postRecovery.match(/<PasswordField/g) || []).length, 1);
  assert.equal(files.platform.includes('type="password"'), false);
  assert.equal(files.recovery.includes('type="password"'), false);
  assert.equal(files.postRecovery.includes('type="password"'), false);
});

test('password visibility is presentation-only and hidden by default', () => {
  assert.match(files.field, /type=\{visible \? 'text' : 'password'\}/);
  assert.match(files.field, /type="button"/);
  assert.match(files.field, /aria-pressed=\{visible\}/);
  assert.match(files.field, /window\.addEventListener\('blur', hide\)/);
  assert.doesNotMatch(files.field, /fetch\(|signIn|updateUser|localStorage|sessionStorage/);
  assert.match(files.styles, /\.eig-password-visibility\s*\{/);
  assert.match(files.styles, /\.platform-login-form \.eig-password-input-wrap input\s*\{/);
});
