'use strict';

// Claim a verified, server-issued handoff in exchange for a NEW Sandbox Auth
// session. Provider tokens are never sent to the browser or Sandbox Auth.
const { createHash } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { configFor } = require('./start.js').__test;

const SANDBOX_URL = 'https://publruuuyvpggogrrgwp.supabase.co';
const COOKIE_NAME = '__Host-eig_sandbox_handoff';
const COOKIE_CLEAR = COOKIE_NAME + '=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax';

function readHandoffCookie(header) {
  const pairs = String(header || '').split(';').map(x => x.trim())
    .filter(x => x.startsWith(COOKIE_NAME + '='));
  if (pairs.length !== 1) return null;
  const token = pairs[0].slice(COOKIE_NAME.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

function allowClaimRequest(req, config) {
  const headers = req.headers || {};
  return !!config && req.method === 'POST' &&
    headers.host === new URL(config.origin).host &&
    headers.origin === config.origin &&
    headers['x-eig-sandbox-claim'] === '1' &&
    (!headers['sec-fetch-site'] || headers['sec-fetch-site'] === 'same-origin') &&
    (!headers['content-type'] || /^application\/json(?:\s*;.*)?$/i.test(headers['content-type'])) &&
    (!headers['content-length'] || Number(headers['content-length']) <= 128);
}

function validSandboxUser(record, allowedId, email) {
  return record?.id === allowedId &&
    typeof record.email === 'string' &&
    record.email.toLowerCase() === email &&
    !!(record.email_confirmed_at || record.confirmed_at) &&
    !record.deleted_at && !record.is_anonymous;
}

function sandboxClients(env) {
  // The secret is ONLY for server functions. Never expose via VITE_*.
  const secret = env.SANDBOX_SERVICE_ROLE_KEY || '';
  const publicKey = env.VITE_SUPABASE_ANON_KEY || '';
  if (!secret || !publicKey ||
      secret === publicKey ||
      secret.startsWith('sb_publishable_') ||
      secret.startsWith('sb_anon_') ||
      publicKey.startsWith('sb_secret_') ||
      publicKey.startsWith('sb_service_')) {
    throw new Error('Sandbox-only server configuration missing');
  }
  if (env.VITE_SUPABASE_URL !== SANDBOX_URL) {
    throw new Error('Sandbox-only Supabase destination required');
  }
  const noPersist = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  return {
    admin: createClient(SANDBOX_URL, secret, noPersist),
    auth: createClient(SANDBOX_URL, publicKey, noPersist),
  };
}

async function exchangeHandoffForSession(handoff, admin, auth) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(String(handoff || ''))) return null;
  const digest = createHash('sha256').update(handoff).digest('hex');
  const { data: allowed, error: err } = await admin.rpc(
    'sandbox_consume_federated_handoff', { p_handoff_hash: digest }
  );
  if (err || allowed?.authorized !== true) return null;
  const userId = allowed.sandbox_user_id;
  const email = allowed.email;
  if (!/^[a-f0-9-]{36}$/i.test(String(userId || '')) ||
      typeof email !== 'string' || email.length > 254) return null;

  // Prevent an admin magiclink for an unexpected identity or a missing user.
  const {data: found, error: userError} = await admin.auth.admin.getUserById(userId);
  if (userError || !validSandboxUser(found?.user, userId, email)) return null;

  // Official Supabase Auth Admin mechanism. Never send the magiclink anywhere.
  // No password is created or shared.
  const {data: link, error: linkError} = await admin.auth.admin.generateLink({
    type: 'magiclink', email
  });
  if (linkError || !link?.properties?.hashed_token ||
      !validSandboxUser(link.user, userId, email)) return null;

  // Verify the hashed one-time code INSIDE this server route, via Sandbox
  // Supabase Auth, resulting in a normal Sandbox-native Auth session.
  const {data: result, error: verifyError} = await auth.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.properties.hashed_token,
  });
  if (verifyError || !validSandboxUser(result?.user, userId, email) ||
      !result?.session?.access_token || !result?.session?.refresh_token) return null;

  // Verify it against the isolated Sandbox Auth service, not a decoded JWT.
  const {data: verified, error: validationError} =
    await auth.auth.getUser(result.session.access_token);
  if (validationError || !validSandboxUser(verified?.user, userId, email)) return null;
  return {
    access_token: result.session.access_token,
    refresh_token: result.session.refresh_token,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Set-Cookie', COOKIE_CLEAR);
  if (req.method !== 'POST') return res.status(405).end();
  const config = configFor(req, process.env);
  if (!allowClaimRequest(req, config)) return res.status(403).end('Practice login is unavailable.');
  const handoff = readHandoffCookie(req.headers?.cookie);
  if (!handoff) return res.status(401).end('No approved practice login.');

  try {
    const {admin, auth} = sandboxClients(process.env);
    const session = await exchangeHandoffForSession(handoff, admin, auth);
    if (!session) return res.status(403).end('Practice login could not be completed.');
    return res.status(200).json(session);
  } catch {
    return res.status(503).end('Practice login is temporarily unavailable.');
  }
};

module.exports.__test = {
  readHandoffCookie, allowClaimRequest, validSandboxUser,
  exchangeHandoffForSession, sandboxClients,
};
