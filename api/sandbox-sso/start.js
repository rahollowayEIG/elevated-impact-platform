'use strict';

const { randomBytes, createHash, createCipheriv } = require('node:crypto');

// A PREPARED, DISABLED-BY-DEFAULT ENTRY POINT. The callback/session broker
// is not implemented. Do not enable before reviewed end-to-end tests.
const LIVE_ISSUER = 'https://aszixzrdayrivungodwq.supabase.co/auth/v1';
const SANDBOX_ORIGIN = 'https://elevationpilot-sandbox.vercel.app';
const COOKIE = '__Host-eig_sandbox_oauth';

function configFor(req, env) {
  if (env.VITE_ELEVATIONPILOT_SANDBOX !== 'true' ||
      env.SANDBOX_SHARED_LOGIN_BACKEND_READY !== 'true') return null;
  if (env.SANDBOX_SHARED_LOGIN_ISSUER !== LIVE_ISSUER ||
      env.SANDBOX_SHARED_LOGIN_ORIGIN !== SANDBOX_ORIGIN ||
      req.headers?.host !== new URL(SANDBOX_ORIGIN).host) return null;
  const clientId = env.SANDBOX_SHARED_LOGIN_CLIENT_ID || '';
  const rawKey = env.SANDBOX_SHARED_LOGIN_STATE_KEY || '';
  if (!/^[a-zA-Z0-9_-]{10,128}$/.test(clientId) ||
      !/^[A-Za-z0-9+/_=-]+$/.test(rawKey)) return null;
  const sealKey = Buffer.from(rawKey, 'base64');
  if (sealKey.length !== 32) return null;
  return { issuer: LIVE_ISSUER, origin: SANDBOX_ORIGIN, clientId, sealKey };
}

function sealState(payload, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

function startUrl(config, state, nonce, challenge) {
  const url = new URL(config.issuer + '/oauth/authorize');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.origin + '/api/sandbox-sso/callback');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email');
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  return url.toString();
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).end();
  const config = configFor(req, process.env);
  if (!config) return res.status(503).end('Shared Sandbox login is not enabled.');
  const state = randomBytes(32).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const cookie = sealState({ state, nonce, verifier, createdAt: Date.now(), origin: config.origin }, config.sealKey);
  res.setHeader('Set-Cookie', `${COOKIE}=${cookie}; Max-Age=300; Path=/; HttpOnly; Secure; SameSite=Lax`);
  res.setHeader('Location', startUrl(config, state, nonce, challenge));
  return res.status(302).end();
};

// Pure helpers support negative tests. No user sessions or secrets exported.
module.exports.__test = { configFor, startUrl };
