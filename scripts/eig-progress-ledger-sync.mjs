// ElevationPilot Build Lab: safe, narrow GitHub event -> existing Google Doc ledger.
// Uses a short-lived federated Google OAuth access token, never Live Supabase credentials.
// No external packages; Node >=20. No external PR code is ever executed here.
const EXPECTED_REPOSITORY = 'rahollowayEIG/elevated-impact-platform';
const EXPECTED_DOCUMENT_ID = '1CtDS6YJ12r8ODk2oCxhIpOiWaHfJgKJk5gNjrbbONNs';
const HEADER = 'ELEVATIONPILOT | PROGRESS & RECOVERY LEDGER';
const SHA = /^[a-f0-9]{40}$/i;
const NUMBER = /^[1-9][0-9]{0,17}$/;
const PR_ACTIONS = new Set(['opened', 'reopened', 'synchronize', 'closed']);

export function prepareEvent(env, payload = {}) {
  if (env.GITHUB_REPOSITORY !== EXPECTED_REPOSITORY)
    throw Error('Ledger sync is restricted to the EIG platform repository.');
  const runId = String(env.GITHUB_RUN_ID || '');
  if (!NUMBER.test(runId)) throw Error('Invalid GitHub run ID.');
  const event = env.GITHUB_EVENT_NAME;
  const runUrl = `https://github.com/${EXPECTED_REPOSITORY}/actions/runs/${runId}`;
  let sha, subject, scope;
  if (event === 'push' || event === 'workflow_dispatch') {
    if (env.GITHUB_REF !== 'refs/heads/main') throw Error('Ledger dispatch is restricted to main.');
    if (!SHA.test(env.GITHUB_SHA || '')) throw Error('Invalid main commit SHA.');
    sha = env.GITHUB_SHA.toLowerCase();
    subject = event === 'push' ? 'Main branch update' : 'Owner-requested recovery checkpoint';
    scope = 'main source snapshot; deployment and functionality not verified';
  } else if (event === 'pull_request_target') {
    const pr = payload.pull_request || {};
    if (!PR_ACTIONS.has(payload.action) || pr.base?.ref !== 'main' ||
        pr.head?.repo?.full_name !== EXPECTED_REPOSITORY ||
        !NUMBER.test(String(pr.number || '')) || !SHA.test(pr.head?.sha || ''))
      throw Error('Only a same-repository, main-targeted PR event can be recorded.');
    sha = pr.head.sha.toLowerCase();
    subject = `PR #${pr.number} ${payload.action}${payload.action === 'closed' ? (pr.merged ? ' (merged)' : ' (not merged)') : ''}`;
    scope = 'source candidate only; review, deployment and user-visible behavior not verified';
  } else throw Error('Unexpected event type for recovery ledger.');
  return Object.freeze({
    marker: `[EIG-AUTO-RUN:${runId}]`,
    text: `\n\nAUTOMATIC GITHUB EVIDENCE | ${new Date().toISOString()}\n` +
      `Event: ${subject}\nSource: ${EXPECTED_REPOSITORY}\nCommit: ${sha}\nRun: ${runUrl}\n` +
      `Status: DISCOVERED (NOT TESTED OR APPROVED)\nScope: ${scope}\n` +
      `Follow-up: compare this exact commit with Vercel active alias, Supabase changes, tests and owner decisions before marking approved.\n` +
      `Marker: [EIG-AUTO-RUN:${runId}]\n`,
  });
}

export function getFirstTab(doc) {
  const first = doc?.tabs?.[0];
  if (first?.documentTab?.body?.content) return {
    text: first.documentTab.body.content.map(x => (x.paragraph?.elements || []).map(e => e.textRun?.content || '').join('')).join(''),
    tabId: first.tabProperties?.tabId,
  };
  if (doc?.body?.content) return {
    text: doc.body.content.map(x => (x.paragraph?.elements || []).map(e => e.textRun?.content || '').join('')).join(''),
    tabId: undefined,
  };
  throw Error('Google Doc has no writable first tab/body.');
}

export function makeAppendRequest(entry, tabId, revisionId) {
  if (!revisionId) throw Error('Missing revision ID; refusing an unguarded write.');
  return {
    requests: [{
      insertText: {
        text: entry.text,
        endOfSegmentLocation: tabId ? { tabId } : {},
      },
    }],
    writeControl: { requiredRevisionId: revisionId },
  };
}

export async function publishToLedger({ token, entry, fetchImpl = fetch, documentId = EXPECTED_DOCUMENT_ID }) {
  if (documentId !== EXPECTED_DOCUMENT_ID || !token || !entry?.marker || !entry?.text)
    throw Error('Ledger target, token or evidence is missing.');
  const url = `https://docs.googleapis.com/v1/documents/${EXPECTED_DOCUMENT_ID}`;
  const headers = { Authorization: `Bearer ${token}` };
  async function readDoc() {
    const response = await fetchImpl(url + '?includeTabsContent=true', { headers });
    if (!response.ok) throw Error(`Google Docs read failed (HTTP ${response.status}).`);
    const doc = await response.json();
    if (doc.documentId !== EXPECTED_DOCUMENT_ID) throw Error('Unexpected Google Doc ID.');
    return doc;
  }
  const before = await readDoc();
  const first = getFirstTab(before);
  if (!first.text.includes(HEADER)) throw Error('Refusing to write: recovery ledger heading not found.');
  if (first.text.includes(entry.marker)) return { kind: 'already-recorded' };
  const response = await fetchImpl(url + ':batchUpdate', {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(makeAppendRequest(entry, first.tabId, before.revisionId)),
  });
  if (!response.ok) throw Error(`Google Docs write failed (HTTP ${response.status}). No success recorded.`);
  const updated = await readDoc();
  if (!getFirstTab(updated).text.includes(entry.marker))
    throw Error('Google Docs readback did not contain event marker.');
  return { kind: 'written-and-verified' };
}

async function run() {
  const eventName = process.env.GITHUB_EVENT_NAME;
  let payload = {};
  if (eventName === 'pull_request_target') {
    if (!process.env.GITHUB_EVENT_PATH) throw Error('GitHub event payload not available.');
    const { readFile } = await import('node:fs/promises');
    payload = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  }
  const entry = prepareEvent(process.env, payload);
  const result = await publishToLedger({
    token: process.env.GOOGLE_DOCS_ACCESS_TOKEN,
    entry,
  });
  // Never print the OAuth token, payload, user emails or document contents.
  console.log(`EIG Progress Ledger: ${result.kind}; ${entry.marker}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  run().catch(err => { console.error('EIG Progress Ledger:', err.message); process.exitCode = 1; });
}
