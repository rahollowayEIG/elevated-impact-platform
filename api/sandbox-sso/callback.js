'use strict';

// Sandbox-only OAuth callback: authenticate the Live identity, then fail closed.
// A separate, audited Sandbox-native session handoff must be implemented before
// turning on the initiation endpoint. Never use Live tokens for Sandbox RLS.
const { createDecipheriv, createPublicKey, timingSafeEqual, verify } = require('node:crypto');
const { configFor } = require('./start.js').__test;

const COOKIE_NAME = '__Host-eig_sandbox_oauth';
const MAX_AGE_MS = 5 * 60 * 1000;
const CALLBACK_PATH = '/api/sandbox-sso/callback';
const COOKIE_CLEAR = COOKIE_NAME + '=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax';

function findStateCookie(header) {
  const matches = String(header || '').split(';').map(x => x.trim())
    .filter(x => x.startsWith(COOKIE_NAME + '='));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(COOKIE_NAME.length + 1);
  return /^[A-Za-z0-9_-]{60,3072}$/.test(token) ? token : null;
}

function unsealState(encrypted, key, now = Date.now()) {
  if (!encrypted || !Buffer.isBuffer(key) || key.length !== 32) return null;
  try {
    const raw = Buffer.from(encrypted, 'base64url');
    if (raw.length < 29 || raw.length > 2304) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const decrypted = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
    const value = JSON.parse(decrypted.toString('utf8'));
    if (!Number.isSafeInteger(value.createdAt) ||
        value.createdAt > now + 30000 ||
        now - value.createdAt > MAX_AGE_MS) return null;
    if (![value.state, value.nonce, value.verifier].every(v =>
        typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v))) return null;
    if (value.origin !== 'https://elevationpilot-sandbox.vercel.app') return null;
    return value;
  } catch {
    return null;
  }
}

function equalState(actual, expected) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(String(actual || ''))) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function decodeTokenSegment(value) {
  if (!/^[A-Za-z0-9_-]{1,12000}$/.test(String(value || ''))) throw new Error('Invalid token encoding');
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length > 8000) throw new Error('Token exceeds allowed length');
  return JSON.parse(bytes.toString('utf8'));
}

function validateIdToken(idToken, keys, config, nonce, now = Date.now()) {
  if (typeof idToken !== 'string' || idToken.length > 16000) return null;
  try {
    const segments = idToken.split('.');
    if (segments.length !== 3) return null;
    const [protectedHeader, payload, signature] = segments;
    const header = decodeTokenSegment(protectedHeader);
    const claims = decodeTokenSegment(payload);
    if (header.alg !== 'ES256' ||
        typeof header.kid !== 'string' || header.kid.length > 150 ||
        (header.typ && header.typ !== 'JWT')) return null;
    if (typeof signature !== 'string' || !/^[A-Za-z0-9_-]+$/.test(signature)) return null;
    const signatureBytes = Buffer.from(signature, 'base64url');
    if (signatureBytes.length !== 64) return null;
    const matches = Array.isArray(keys) ? keys.filter(key =>
      key.kid === header.kid && key.kty === 'EC' && key.crv === 'P-256' &&
      (!key.alg || key.alg === 'ES256') && (!key.use || key.use === 'sig') &&
      typeof key.x === 'string' && typeof key.y === 'string' && !key.d
    ) : [];
    if (matches.length !== 1) return null;
    const publicKey = createPublicKey({key: matches[0], format: 'jwk'});
    const checked = verify('sha256', Buffer.from(protectedHeader + '.' + payload),
      {key: publicKey, dsaEncoding: 'ieee-p1363'}, signatureBytes);
    if (!checked) return null;
    if (claims.iss !== config.issuer) return null;
    const audience = claims.aud;
    if (typeof audience === 'string') {
      if (audience !== config.clientId) return null;
    } else if (Array.isArray(audience) && audience.length > 0) {
      if (!audience.includes(config.clientId) || claims.azp !== config.clientId) return null;
    } else return null;
    if (claims.azp && claims.azp !== config.clientId) return null;
    const epoch = Math.floor(now / 1000);
    if (!Number.isSafeInteger(claims.exp) || claims.exp <= epoch ||
        !Number.isSafeInteger(claims.iat) || claims.iat > epoch + 30 ||
        claims.iat < epoch - 600 ||
        claims.nonce !== nonce) return null;
    if (typeof claims.sub !== 'string' ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(claims.sub)) return null;
    if (claims.email_verified !== true ||
        typeof claims.email !== 'string' ||
        claims.email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)) return null;
    // Return identity facts only, never a token or production privileges.
    return Object.freeze({id: claims.sub, email: claims.email.toLowerCase()});
  } catch {
    return null;
  }
}

async function fetchJson(url, options = {}, fetcher = fetch) {
  const response = await fetcher(url, {
    ...options,
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('Provider unavailable');
  const declaredSize = Number(response.headers?.get?.('content-length') || 0);
  if (declaredSize > 32768) throw new Error('Response too large');
  const text = await response.text();
  if (text.length > 32768) throw new Error('Response too large');
  return JSON.parse(text);
}

async function verifyCodeForIdentity(code, state, config, fetcher = fetch) {
  const secret = process.env.SANDBOX_SHARED_LOGIN_CLIENT_SECRET;
  // Confidential OAuth client. Its secret must never be browser-visible.
  if (typeof secret !== 'string' || secret.length < 16) throw new Error('Broker not configured');
  const basic = Buffer.from(config.clientId + ':' + secret).toString('base64');
  const tokens = await fetchJson(config.issuer + '/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + basic,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.origin + CALLBACK_PATH,
      code_verifier: state.verifier,
    }),
  }, fetcher);
  if (!tokens || typeof tokens.id_token !== 'string') throw new Error('No ID token');
  // Do not return / forward access_token or refresh_token to any Sandbox API.
  const jwks = await fetchJson(config.issuer + '/.well-known/jwks.json', {}, fetcher);
  return validateIdToken(tokens.id_token, jwks.keys, config, state.nonce);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Set-Cookie', COOKIE_CLEAR);
  if (req.method !== 'GET') return res.status(405).end();
  const config = configFor(req, process.env);
  if (!config) return res.status(503).end('Shared Sandbox login is not enabled.');
  const query = req.query || {};
  if (Array.isArray(query.state) || Array.isArray(query.code)) return res.status(400).end('Invalid sign-in response.');
  const state = unsealState(findStateCookie(req.headers?.cookie), config.sealKey);
  if (!state || !equalState(query.state, state.state)) return res.status(400).end('Invalid or expired sign-in.');
  if (typeof query.code !== 'string' || query.code.length < 10 ||
      query.code.length > 2048 || !/^[A-Za-z0-9_.~-]+$/.test(query.code)) {
    return res.status(400).end('Sign-in not approved.');
  }
  try {
    const identity = await verifyCodeForIdentity(query.code, state, config);
    if (!identity) return res.status(403).end('Identity verification failed.');
    // Intentionally no account creation, permissions grant, cookies or session.
    // Next phase: one-use, Sandbox-native session, after audited allowlist checks.
    return res.status(503).end('Identity verified. Sandbox session handoff is not enabled yet.');
  } catch {
    return res.status(503).end('Sign-in could not be completed.');
  }
};

module.exports.__test = {findStateCookie, unsealState, equalState, validateIdToken, verifyCodeForIdentity};
