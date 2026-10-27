import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateRegistry, checkPreflight, parseFlags } from '../scripts/elevationpilot-version-guard.mjs';

const registry = JSON.parse(readFileSync(new URL('../config/elevationpilot-approved-versions.json', import.meta.url), 'utf8'));
const copy = value => JSON.parse(JSON.stringify(value));
const sandboxEvidence = {
  environment:'sandbox', branch:'feature/sandbox-session-header-20261019',
  commit:'eb399c0e8b5cc32e39b820c685b92e3cbafe1585',
  project:'elevationpilot-sandbox',
  domain:'elevationpilot-sandbox.vercel.app',
  backend:'publruuuyvpggogrrgwp',
  signatures:['elevationpilot-sandbox','SandboxAccessGate','SandboxPracticeRoles','Switch role'],
};

test('unverified versions cannot be shared as approved even when build is READY', () => {
  assert.deepEqual(validateRegistry(registry), []);
  assert.match(checkPreflight(registry,sandboxEvidence).join(' '), /no owner-approved version/);
});

test('legacy fictional-persona version is blocked even if someone supplies its commit', () => {
  const r = copy(registry);
  Object.assign(r.environments.sandbox, {
    approval_status:'approved',observed_branch:sandboxEvidence.branch,
    approved_commit:sandboxEvidence.commit, approved_by:'EIG owner',
    approved_at:'2026-10-26',rollback_commit:'b7e92abec4b6e1b43b7788009f1162ed3b751087'
  });
  assert.deepEqual(checkPreflight(r,sandboxEvidence), []);
  const wrong = {...sandboxEvidence,branch:'feature/sandbox-personas-auth-foundation-20261018',
    signatures:['elevationpilot-sandbox','SandboxPersonaLogin','SandboxAccessGate','SandboxPracticeRoles','Switch role']};
  const errors=checkPreflight(r,wrong).join(' ');
  assert.match(errors,/source branch does not match/);
  assert.match(errors,/superseded UI detected/);
});

test('preflight blocks accidental live/sandbox URL and backend crossover', () => {
  const r=copy(registry);
  Object.assign(r.environments.sandbox, {
    approval_status:'approved',observed_branch:sandboxEvidence.branch,
    approved_commit:sandboxEvidence.commit, approved_by:'EIG owner',
    approved_at:'2026-10-26',rollback_commit:'b7e92abec4b6e1b43b7788009f1162ed3b751087'
  });
  const errors=checkPreflight(r,{
    ...sandboxEvidence,
    project:'elevated-impact-platform',
    domain:'elevated-impact-platform.vercel.app',
    backend:'aszixzrdayrivungodwq',
    signatures:['Switch role']
  }).join(' ');
  assert.match(errors,/wrong Vercel project/);
  assert.match(errors,/not the approved canonical domain/);
  assert.match(errors,/incorrect backend environment/);
  assert.match(errors,/UI evidence missing/);
});

test('owner sign-off and a distinct rollback point are compulsory for approved entries',()=>{
  const r=copy(registry);
  r.environments.live.approval_status='approved';
  const errors=validateRegistry(r).join(' ');
  assert.match(errors,/approved version missing approved_by/);
  assert.match(errors,/approved version missing rollback_commit/);
});

test('duplicate domain assignments are prohibited',()=>{
  const r=copy(registry);
  r.environments.sandbox.canonical_domain=r.environments.live.canonical_domain;
  assert.match(validateRegistry(r).join(' '),/domain reused by multiple environments/);
});

test('preflight CLI supports only explicit flag/value pairs',()=>{
  assert.deepEqual(parseFlags(['--environment','sandbox','--source-branch','feature/demo']),{environment:'sandbox',source_branch:'feature/demo'});
  assert.throws(()=>parseFlags(['--environment']),/Expected --key value flag/);
});
