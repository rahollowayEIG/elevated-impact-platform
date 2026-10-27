#!/usr/bin/env node
// Rule 3: Fail closed before referring people to an allegedly "approved" build.
// Build READY is not owner approval. This command never modifies deployments.
import { readFileSync } from 'node:fs';

export const STATUS = new Set(['approved', 'verification_required', 'blocked', 'retired']);
const hex40 = /^[a-f0-9]{40}$/;
const validHost = /^[a-z\d][a-z\d.-]*\.[a-z]{2,}$/i;
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

export function validateRegistry(registry) {
  const errors = [];
  if (registry?.schema_version !== 1) errors.push('Unknown registry schema');
  const envs = registry?.environments || {};
  if (!envs.live || !envs.sandbox) errors.push('Live and Sandbox entries are required');
  const domains = new Set();
  for (const [name, env] of Object.entries(envs)) {
    if (!STATUS.has(env.approval_status)) errors.push(name + ': unknown approval_status');
    if (!nonempty(env.vercel_project)) errors.push(name + ': Vercel project required');
    if (!validHost.test(env.canonical_domain || '')) errors.push(name + ': invalid canonical domain');
    if (domains.has(env.canonical_domain)) errors.push(name + ': domain reused by multiple environments');
    domains.add(env.canonical_domain);
    if (env.approved_commit && !hex40.test(env.approved_commit)) errors.push(name + ': approved commit must be a 40-character SHA');
    if (env.observed_commit && !hex40.test(env.observed_commit)) errors.push(name + ': observed commit must be a 40-character SHA');
    if (!Array.isArray(env.required_ui_signatures) || !Array.isArray(env.forbidden_ui_signatures)) errors.push(name + ': UI signatures required');
    if (env.approval_status === 'approved') {
      for (const field of ['observed_branch','approved_commit','approved_by','approved_at','rollback_commit']) {
        if (!nonempty(env[field])) errors.push(name + ': approved version missing ' + field);
      }
      if (env.approved_commit === env.rollback_commit) errors.push(name + ': rollback cannot be the same commit');
    }
    if (name === 'sandbox') {
      if (env.expected_backend !== 'publruuuyvpggogrrgwp') errors.push('Sandbox Supabase target mismatch');
      if (!env.required_ui_signatures.includes('Switch role')) errors.push('Sandbox must require Switch role');
      if (!env.forbidden_ui_signatures.includes('SandboxPersonaLogin')) errors.push('Sandbox must prohibit fictional-name persona login');
    }
  }
  return errors;
}

export function checkPreflight(registry, details) {
  const errors = validateRegistry(registry);
  const env = registry?.environments?.[details.environment];
  if (!env) return [...errors, 'Unknown environment: ' + details.environment];
  if (env.approval_status !== 'approved') errors.push(details.environment + ': no owner-approved version; do not share or promote this URL');
  if (!nonempty(details.branch) || details.branch !== env.observed_branch) errors.push(details.environment + ': source branch does not match approved version');
  if (!nonempty(details.commit) || details.commit !== env.approved_commit) errors.push(details.environment + ': exact commit does not match approved version');
  if (details.project !== env.vercel_project) errors.push(details.environment + ': wrong Vercel project');
  if (details.domain !== env.canonical_domain) errors.push(details.environment + ': not the approved canonical domain');
  if (details.backend !== env.expected_backend) errors.push(details.environment + ': incorrect backend environment');
  const signatures = details.signatures || [];
  for (const marker of env.required_ui_signatures) {
    if (!signatures.includes(marker)) errors.push(details.environment + ': UI evidence missing "' + marker + '"');
  }
  for (const forbidden of env.forbidden_ui_signatures) {
    if (signatures.includes(forbidden)) errors.push(details.environment + ': superseded UI detected "' + forbidden + '"');
  }
  return errors;
}

export function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!flag.startsWith('--') || i + 1 >= args.length) throw Error('Expected --key value flag');
    const name = flag.slice(2).replaceAll('-', '_');
    flags[name] = args[++i];
  }
  return flags;
}

if (process.argv[1]?.endsWith('elevationpilot-version-guard.mjs')) {
  const command = process.argv[2] || 'audit';
  try {
    const registry = JSON.parse(readFileSync(new URL('../config/elevationpilot-approved-versions.json', import.meta.url), 'utf8'));
    if (command === 'audit') {
      const errors = validateRegistry(registry);
      for (const [name, env] of Object.entries(registry.environments)) {
        console.log(name + ': ' + env.approval_status + ' | ' + env.vercel_project + ' | ' + env.canonical_domain);
        if (env.approval_status !== 'approved') console.log('  VERIFY FIRST: No active owner-approved link is registered.');
      }
      if (errors.length) throw Error(errors.join('\n'));
    } else if (command === 'preflight') {
      const flags = parseFlags(process.argv.slice(3));
      const details = {
        environment:flags.environment,
        branch:flags.branch, commit:flags.commit, project:flags.project,
        domain:flags.domain, backend:flags.backend,
        signatures:(flags.signatures || '').split(',').filter(Boolean)
      };
      const errors = checkPreflight(registry, details);
      if (errors.length) throw Error(errors.join('\n'));
      console.log('Approved version preflight passed: ' + details.environment);
    } else {
      throw Error('Usage: node scripts/elevationpilot-version-guard.mjs audit|preflight --environment ... --branch ... --commit ... --project ... --domain ... --backend ... --signatures a,b');
    }
  } catch (error) {
    console.error('Rule 3 blocked: ' + error.message);
    process.exitCode = 1;
  }
}
