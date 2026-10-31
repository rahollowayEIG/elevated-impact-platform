/**
 * Sandbox-only, fail-closed access checks.
 * Browser code cannot enroll users, choose a tenant, or grant itself a role.
 * The server-owned practice_testers allowlist is the sole access authority.
 */
export const SANDBOX_ACCESS_ROLES = Object.freeze(['pilot', 'co_pilot', 'atc', 'passenger']);

export function normalizeSandboxEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

export function isSandboxEmailCode(value) {
  return /^\d{6}$/.test(String(value || '').trim());
}

export function validateSandboxEntitlements(payload) {
  if (!payload || payload.authorized !== true || !Array.isArray(payload.roles)) {
    return null;
  }
  // An unexpected role is a misconfiguration, not a reason to proceed.
  if (!payload.roles.length ||
      !payload.roles.every(role => SANDBOX_ACCESS_ROLES.includes(role)) ||
      !payload.roles.includes(payload.active_role)) {
    return null;
  }
  return Object.freeze({
    activeRole: payload.active_role,
    roles: Object.freeze([...new Set(payload.roles)]),
    hasPracticeEvent: payload.has_practice_event === true,
  });
}

export async function checkSandboxAccess(client) {
  if (!client?.auth?.getUser || typeof client.rpc !== 'function') {
    return { kind: 'unavailable' };
  }
  try {
    // getUser verifies the user with the isolated Sandbox Auth service.
    // The local SDK session object alone must never authorize an app route.
    const { data: identity, error: identityError } = await client.auth.getUser();
    if (identityError || !identity?.user) return { kind: 'signed_out' };
    const user = identity.user;
    if (!user.email || !(user.email_confirmed_at || user.confirmed_at)) {
      return { kind: 'denied', email: '' };
    }

    // The RPC checks auth.uid(), server-side allowlist, tenant isolation,
    // enabled status, forbidden EIG Admin membership and business roles.
    const { data: payload, error } = await client.rpc('sandbox_practice_role_status');
    if (error) return { kind: 'unavailable' };
    const access = validateSandboxEntitlements(payload);
    if (!access) return { kind: 'denied', email: user.email };
    return { kind: 'authorized', email: user.email, access };
  } catch {
    return { kind: 'unavailable' };
  }
}

/** Optional internal bootstrap only. Supabase must have an AUTH user already. */
export async function requestSandboxEmailCode(client, email, enabled = false) {
  const normalized = normalizeSandboxEmail(email);
  if (!enabled || !normalized || !client?.auth?.signInWithOtp) {
    return { ok: false, reason: 'unavailable' };
  }
  try {
    const { error } = await client.auth.signInWithOtp({
      email: normalized,
      options: {
        shouldCreateUser: false,
        // No redirect, callback, Live credentials or URL session tokens.
        // The isolated Auth email template MUST use {{ .Token }} for OTP.
      },
    });
    // Return a generic result so no existence/profile data leaks in the UI.
    return error ? { ok: false, reason: 'failed' } : { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export async function verifySandboxEmailCode(client, email, code, enabled = false) {
  const normalized = normalizeSandboxEmail(email);
  const token = String(code || '').trim();
  if (!enabled || !normalized || !isSandboxEmailCode(token) || !client?.auth?.verifyOtp) {
    return { ok: false, reason: 'unavailable' };
  }
  try {
    const { data, error } = await client.auth.verifyOtp({
      email: normalized,
      token,
      type: 'email',
    });
    return !error && !!data?.session
      ? { ok: true }
      : { ok: false, reason: 'failed' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
