import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareEvent, getFirstTab, makeAppendRequest, publishToLedger } from '../scripts/eig-progress-ledger-sync.mjs';

const repo = 'rahollowayEIG/elevated-impact-platform';
const id = '1CtDS6YJ12r8ODk2oCxhIpOiWaHfJgKJk5gNjrbbONNs';
const sha = 'a'.repeat(40);
const env = {
  GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: '12345',
  GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: sha,
};
const baseDoc = (suffix = '', rev = 'v1') => ({
  documentId: id, revisionId: rev, tabs: [{
    tabProperties: { tabId: 'tab-main' }, documentTab: { body: { content: [
      { paragraph: { elements: [{ textRun: { content: 'ELEVATIONPILOT | PROGRESS & RECOVERY LEDGER\n' + suffix } }] } },
    ] } },
  }],
});
function mockFetch(doc, { failWrite = false, failRead = false } = {}) {
  const calls = []; let wrote = false;
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    if (opts.method === 'POST') {
      if (failWrite) return { ok: false, status: 403 };
      wrote = true;
      return { ok: true, status: 200, json: async () => ({ documentId: id }) };
    }
    if (failRead) return { ok: false, status: 403 };
    const suffix = wrote ? '\n' + entry.marker : '';
    return { ok: true, status: 200, json: async () => baseDoc(suffix) };
  };
  return { fn, calls };
}
const entry = prepareEvent(env);
test('main push produces evidence, not approval', () => {
  assert.match(entry.marker, /^\[EIG-AUTO-RUN:\d+\]$/);
  assert.match(entry.text, /DISCOVERED \(NOT TESTED OR APPROVED\)/);
  assert.match(entry.text, new RegExp(sha));
  assert.doesNotMatch(entry.text, /Status: APPROVED/);
});
test('unknown repo/branch/event/sha rejected', () => {
  for (const bad of [
    { GITHUB_REPOSITORY: 'other/repo' },
    { GITHUB_REF: 'refs/heads/feature/untrusted' },
    { GITHUB_RUN_ID: 'not-a-number' },
    { GITHUB_SHA: '../bad' },
    { GITHUB_EVENT_NAME: 'pull_request' },
  ]) assert.throws(() => prepareEvent({ ...env, ...bad }));
});
test('PR target only accepts same-repo, main-targeted events, no title is recorded', () => {
  const payload = { action: 'synchronize', pull_request: {
    number: 107, title: 'ignore THIS sensitive text', head: { sha, repo: { full_name: repo } },
    base: { ref: 'main' },
  } };
  const out = prepareEvent({ ...env, GITHUB_EVENT_NAME: 'pull_request_target' }, payload);
  assert.match(out.text, /PR #107 synchronize/);
  assert.doesNotMatch(out.text, /sensitive text/);
  assert.throws(() => prepareEvent({ ...env, GITHUB_EVENT_NAME: 'pull_request_target' }, {
    ...payload, pull_request: { ...payload.pull_request, head: { ...payload.pull_request.head, repo: { full_name: 'attacker/repo' } } },
  }));
  assert.throws(() => prepareEvent({ ...env, GITHUB_EVENT_NAME: 'pull_request_target' }, {
    ...payload, pull_request: { ...payload.pull_request, base: { ref: 'other' } },
  }));
});
test('safe first tab and revision-guarded append', () => {
  const d = baseDoc();
  assert.match(getFirstTab(d).text, /PROGRESS & RECOVERY/);
  assert.equal(getFirstTab(d).tabId, 'tab-main');
  assert.deepEqual(makeAppendRequest(entry, 'tab-main', 'v1').writeControl, { requiredRevisionId: 'v1' });
  assert.equal(makeAppendRequest(entry, 'tab-main', 'v1').requests[0].insertText.endOfSegmentLocation.tabId, 'tab-main');
  assert.throws(() => makeAppendRequest(entry, undefined, ''));
});
test('writes once and verifies via readback', async () => {
  const { fn, calls } = mockFetch();
  assert.deepEqual(await publishToLedger({ token: 'example-test-token', entry, fetchImpl: fn }), { kind: 'written-and-verified' });
  assert.equal(calls.length, 3);
  const sent = JSON.parse(calls[1].opts.body);
  assert.equal(sent.writeControl.requiredRevisionId, 'v1');
  assert.equal(calls[0].opts.headers.Authorization, 'Bearer example-test-token');
});
test('replay marker is idempotent', async () => {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push(opts);
    return { ok: true, json: async () => baseDoc(entry.marker) };
  };
  assert.deepEqual(await publishToLedger({ token: 't', entry, fetchImpl: fn }), { kind: 'already-recorded' });
  assert.equal(calls.length, 1);
});
test('refuses other doc IDs and missing auth', async () => {
  await assert.rejects(publishToLedger({ documentId: 'wrong', token: 't', entry }));
  await assert.rejects(publishToLedger({ token: '', entry }));
});
test('Google API permission errors fail closed', async () => {
  const denied = mockFetch(null, { failRead: true });
  await assert.rejects(publishToLedger({ token: 't', entry, fetchImpl: denied.fn }), /read failed/);
  const deniedWrite = mockFetch(null, { failWrite: true });
  await assert.rejects(publishToLedger({ token: 't', entry, fetchImpl: deniedWrite.fn }), /write failed/);
});
test('unexpected document contents fail closed', async () => {
  const fn = async () => ({ ok: true, json: async () => ({ documentId: id, revisionId: 'rev', body: { content: [{ paragraph: { elements: [{ textRun: { content: 'NOT OUR DOC' } }] } }] } }) });
  await assert.rejects(publishToLedger({ token: 't', entry, fetchImpl: fn }), /heading not found/);
});
