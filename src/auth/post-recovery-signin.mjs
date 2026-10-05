// This controller receives only a completed recovery's ID/email, never its token
// or password. Loading the shared client is deferred until explicit consent.
export class AccountSwitchError extends Error {
  constructor(code, message) { super(message); this.name = 'AccountSwitchError'; this.code = code; }
}

const normalize = (value) => String(value || '').trim().toLowerCase();
const problem = (code, message) => new AccountSwitchError(code, message);

export function createPostRecoverySignInController(identity, loadClient) {
  if (!identity?.id || !identity?.email || typeof loadClient !== 'function') {
    throw problem('missing_identity', 'Complete password recovery before switching accounts.');
  }
  const target = Object.freeze({ id: identity.id, email: identity.email });
  let client;
  let phase = 'new';
  let preparing;
  const match = (user) => Boolean(user?.id === target.id && normalize(user.email) === normalize(target.email));
  const sessionChanged = () => problem('session_changed', 'Another tab signed in while this page was open. Start the account switch again before signing in here.');

  async function currentSession() {
    const result = await client.auth.getSession();
    if (result.error) throw problem('session_unconfirmed', 'We could not confirm this browser session. Start the account switch again.');
    return result.data?.session || null;
  }

  function prepare() {
    if (phase === 'preparing') return preparing;
    if (phase === 'signing_in' || phase === 'complete') {
      return Promise.reject(problem('busy', 'This account switch is already being completed.'));
    }
    phase = 'preparing';
    preparing = (async () => {
      try {
        client = await loadClient();
        if (!client?.auth || !client?.functions) throw new Error('No client');
        // Explicit local scope. Never sign the other account out everywhere.
        const result = await client.auth.signOut({ scope: 'local' });
        if (result.error) throw new Error('Sign-out failed');
        if (await currentSession()) throw sessionChanged();
        phase = 'ready';
        return target;
      } catch (error) {
        phase = 'blocked';
        throw error instanceof AccountSwitchError ? error : problem('signout_failed', 'We could not finish signing out this browser. No new sign-in was attempted. Try the account switch again.');
      }
    })();
    return preparing;
  }

  async function signIn(password) {
    if (phase !== 'ready') throw problem('not_ready', 'Start the account switch before entering your new password.');
    if (typeof password !== 'string' || !password) throw problem('password_required', 'Enter the new password for this account.');
    phase = 'signing_in';
    try {
      if (await currentSession()) throw sessionChanged();
      // Reuse the normal platform credential check. Do not select an account
      // from browser storage, URL parameters, or the editable DOM.
      const result = await client.functions.invoke('golf-account-auth', {
        body: { action: 'sign_in', identifier: target.email, password },
      });
      if (result.error || result.data?.error || !result.data?.access_token || !result.data?.refresh_token) {
        phase = 'ready';
        throw problem('signin_failed', 'Sign-in did not complete. Re-enter the new password for the email shown and try again. If it keeps failing, contact EIG.');
      }
      const grant = result.data;
      const verified = await client.auth.getUser(grant.access_token);
      if (verified.error || !match(verified.data?.user)) {
        throw problem('identity_mismatch', 'The sign-in response did not match the account you reset. This page will not open another account. Contact EIG for help.');
      }
      // A second tab may have signed in during the network request.
      if (await currentSession()) throw sessionChanged();
      const installed = await client.auth.setSession({ access_token: grant.access_token, refresh_token: grant.refresh_token });
      if (installed.error || !match(installed.data?.user)) {
        throw problem('signin_unconfirmed', 'We could not confirm the new browser sign-in. Start the account switch again.');
      }
      const saved = await currentSession();
      if (!saved?.access_token || !match(saved.user)) throw sessionChanged();
      const checked = await client.auth.getUser(saved.access_token);
      if (checked.error || !match(checked.data?.user)) throw sessionChanged();
      phase = 'complete';
      return target;
    } catch (error) {
      if (phase !== 'ready') phase = 'blocked';
      throw error instanceof AccountSwitchError ? error : problem('signin_unconfirmed', 'We could not confirm the sign-in. Stay on this page and start the account switch again.');
    }
  }

  return Object.freeze({ prepare, signIn, getPhase: () => phase });
}
