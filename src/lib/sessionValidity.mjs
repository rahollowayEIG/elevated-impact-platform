// Verify the existing browser session with Auth. Network failures alone do not
// log anyone out, and an old check must never clear a newer sign-in or token.
export function createSessionVerifier({ auth, session, isCurrent, onInvalid }) {
  let stopped = false;
  let pending = false;
  let invalidated = false;
  const current = () => !stopped && !invalidated && isCurrent();
  async function check() {
    if (!current() || pending) return;
    pending = true;
    try {
      const { data, error } = await auth.getUser(session.access_token);
      if (!current()) return;
      const invalid = error
        ? error.status === 401 || error.status === 403 || ['session_not_found', 'refresh_token_not_found', 'refresh_token_already_used', 'user_not_found', 'bad_jwt'].includes(error.code)
        : Boolean(data?.user && data.user.id !== session.user.id);
      if (!invalid) return;
      const latest = await auth.getSession();
      if (!current() || latest.error || latest.data?.session?.access_token !== session.access_token) return;
      invalidated = true;
      onInvalid();
      // Local scope clears this browser's stale credentials without signing out
      // other devices or accounts. Auth serializes its storage operations.
      await auth.signOut({ scope: 'local' });
    } catch { /* Retry on focus or the next visible-tab check after outages. */ }
    finally { pending = false; }
  }
  return { check, stop: () => { stopped = true; } };
}
