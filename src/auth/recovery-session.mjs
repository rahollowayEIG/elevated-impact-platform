/** Password recovery deliberately never reads the platform's persisted session. */
const NON_RECOVERY_TYPES = new Set(['signup', 'invite', 'magiclink', 'email', 'email_change']);
const SENSITIVE_KEYS = ['token_hash', 'access_token', 'refresh_token', 'code', 'token', 'recovery_email', 'error', 'error_code', 'error_description'];

export class RecoveryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RecoveryError';
    this.code = code;
  }
}

const invalidLink = () => new RecoveryError('invalid_link', 'This link could not be verified. Return to sign in and request a new password-reset email.');
const disabledAccount = () => new RecoveryError('account_disabled', 'This account is disabled. Contact EIG so an administrator can review its access before you try password recovery again.');
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

/** URL fields identify a flow, never authorize a password change. */
export function parseRecoveryEntry(href) {
  const url = new URL(href);
  const query = url.searchParams;
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
  const types = [...query.getAll('type'), ...fragment.getAll('type')].filter(Boolean);
  const type = types[0] || '';
  const hinted = query.get('recovery') === '1' || types.includes('recovery');
  const hasCredentials = ['token_hash', 'code'].some((key) => query.has(key)) || ['access_token', 'refresh_token'].some((key) => fragment.has(key));
  if (!hinted && !hasCredentials) return { kind: 'normal' };

  const duplicate = [...SENSITIVE_KEYS, 'type', 'recovery'].some((key) => query.getAll(key).length > 1 || fragment.getAll(key).length > 1);
  const conflict = new Set(types).size > 1;
  const hasError = ['error', 'error_code', 'error_description'].some((key) => query.has(key) || fragment.has(key));
  // Some old verification emails incorrectly included recovery=1. They must
  // continue as verification, not acquire password-reset privileges.
  if (!duplicate && !conflict && !hasError && NON_RECOVERY_TYPES.has(type)) {
    url.searchParams.delete('recovery');
    url.searchParams.delete('recovery_email');
    return { kind: 'normal', normalizedUrl: url.pathname + url.search + url.hash };
  }

  const entry = { kind: 'recovery', mode: 'invalid', expectedEmail: normalizeEmail(query.get('recovery_email')) };
  if (duplicate || conflict) return entry;
  if (hasError) {
    const code = query.get('error_code') || fragment.get('error_code') || '';
    const description = query.get('error_description') || fragment.get('error_description') || '';
    entry.error = code === 'user_banned' || /user is banned/i.test(description) ? 'account_disabled' : 'invalid_link';
    return entry;
  }
  const tokenHash = query.get('token_hash');
  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  // Do not accept mixed credential mechanisms or an arbitrary ?recovery=1.
  if (tokenHash && !accessToken && !query.has('code') && type === 'recovery') {
    return { ...entry, mode: 'token_hash', tokenHash };
  }
  if (accessToken && refreshToken && !tokenHash && !query.has('code') && fragment.get('type') === 'recovery') {
    return { ...entry, mode: 'implicit', accessToken };
  }
  // This platform uses implicit self-service links and token-hash admin links.
  // A PKCE/unknown callback must fail closed, never fall back to another login.
  return entry;
}

export function cleanRecoveryUrl(href) {
  const url = new URL(href);
  // No callback secrets, email hints, or provider errors survive in history.
  return url.pathname + '?recovery=1';
}

/** Only the public project key is used; all authority comes from the link. */
export function createRecoveryApi({ supabaseUrl, publicKey, fetchImpl = globalThis.fetch, timeoutMs = 15000 }) {
  let base;
  try { base = new URL(supabaseUrl); } catch { throw new RecoveryError('configuration', 'Account recovery is not configured. Contact EIG.'); }
  if (base.protocol !== 'https:' || !publicKey || typeof fetchImpl !== 'function') {
    throw new RecoveryError('configuration', 'Account recovery is not configured. Contact EIG.');
  }
  const root = base.origin + '/auth/v1';
  async function request(path, method, body, accessToken) {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const response = await fetchImpl(root + path, {
        method,
        headers: { apikey: publicKey, 'Content-Type': 'application/json', ...(accessToken ? { Authorization: 'Bearer ' + accessToken } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: abort.signal,
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        redirect: 'error',
      });
      if (response.status === 204 && response.ok) return {};
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const code = result?.code || result?.error_code || '';
        const message = result?.msg || result?.message || result?.error_description || '';
        if (code === 'user_banned' || /user is banned/i.test(message)) throw disabledAccount();
        if (response.status === 429) throw new RecoveryError('rate_limit', 'Too many attempts. Wait a moment before trying again.');
        if (method === 'PUT' && (code === 'weak_password' || code === 'same_password')) {
          throw new RecoveryError('password_rejected', 'Choose a different, stronger password and try again.');
        }
        throw invalidLink();
      }
      if (!result || typeof result !== 'object') {
        if (method === 'PUT') throw new RecoveryError('save_unconfirmed', 'The service did not confirm the password update. Contact EIG before retrying.');
        throw invalidLink();
      }
      return result;
    } catch (error) {
      if (error instanceof RecoveryError) throw error;
      throw new RecoveryError(method === 'PUT' ? 'save_unconfirmed' : 'network', method === 'PUT'
        ? 'We could not confirm whether the password was saved. Try signing in or request a new reset link. Do not keep submitting this form.'
        : 'We could not verify the link with the account service. Return to sign in and request a new link when the connection is available.');
    } finally { clearTimeout(timeout); }
  }
  return {
    verify: (tokenHash) => request('/verify', 'POST', { token_hash: tokenHash, type: 'recovery' }),
    getUser: (accessToken) => request('/user', 'GET', undefined, accessToken),
    updatePassword: (accessToken, password) => request('/user', 'PUT', { password }, accessToken),
    endSession: (accessToken) => request('/logout?scope=local', 'POST', undefined, accessToken),
  };
}

/** The verified identity and its bearer are private, memory-only, and pinned. */
export function createRecoveryController(entry, api) {
  let credentials = { ...entry };
  let accessToken = '';
  let identity = null;
  let phase = 'new';
  let verificationPromise;
  const checkedUser = (user, expectedId, expectedEmail) => {
    if (!user?.id || !user?.email || (expectedId && user.id !== expectedId) || (expectedEmail && normalizeEmail(user.email) !== expectedEmail)) {
      throw new RecoveryError('identity_mismatch', 'The recovery session could not be matched to the intended account. The password change is blocked. Request a new link for that account.');
    }
    if (user.banned_until && new Date(user.banned_until).getTime() > Date.now()) throw disabledAccount();
    return Object.freeze({ id: user.id, email: user.email });
  };
  const clear = () => { credentials = null; accessToken = ''; };

  function verify() {
    // React StrictMode, rerenders, or double clicks cannot redeem a token twice.
    if (verificationPromise) return verificationPromise;
    verificationPromise = (async () => {
      phase = 'verifying';
      try {
        if (credentials?.error === 'account_disabled') throw disabledAccount();
        if (!credentials || credentials.kind !== 'recovery' || !['token_hash', 'implicit'].includes(credentials.mode)) throw invalidLink();
        const expectedEmail = credentials.expectedEmail;
        let responseUserId;
        if (credentials.mode === 'token_hash') {
          const grant = await api.verify(credentials.tokenHash);
          if (!grant?.access_token || !grant?.user?.id) throw invalidLink();
          accessToken = grant.access_token;
          responseUserId = grant.user.id;
        } else { accessToken = credentials.accessToken; }
        credentials = null;
        identity = checkedUser(await api.getUser(accessToken), responseUserId, expectedEmail);
        phase = 'ready';
        return identity;
      } catch (error) {
        phase = 'blocked';
        clear();
        throw error instanceof RecoveryError ? error : invalidLink();
      }
    })();
    return verificationPromise;
  }

  async function savePassword(password) {
    if (phase !== 'ready' || !identity || !accessToken) throw invalidLink();
    if (typeof password !== 'string' || password.length < 8) {
      throw new RecoveryError('password_rejected', 'Use at least 8 characters for your new password.');
    }
    phase = 'saving';
    const pinnedToken = accessToken;
    let updating = false;
    try {
      // Revalidate immediately before submitting, with the SAME immutable bearer.
      checkedUser(await api.getUser(pinnedToken), identity.id, normalizeEmail(identity.email));
      updating = true;
      const updated = await api.updatePassword(pinnedToken, password);
      try { checkedUser(updated, identity.id, normalizeEmail(identity.email)); }
      catch { throw new RecoveryError('save_unconfirmed', 'The service returned an unexpected account after saving. Stop here and contact EIG before retrying.'); }
      phase = 'complete';
      clear();
      // Ends only the recovery session, not a different signed-in account.
      await api.endSession(pinnedToken).catch(() => {});
      return identity;
    } catch (error) {
      const safeError = error instanceof RecoveryError ? error : invalidLink();
      if (updating && ['password_rejected', 'rate_limit'].includes(safeError.code)) phase = 'ready';
      else { phase = 'blocked'; clear(); }
      throw safeError;
    }
  }

  return Object.freeze({ verify, savePassword, getPhase: () => phase });
}
