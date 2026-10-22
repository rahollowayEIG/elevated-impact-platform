// Sandbox-only browser handoff. A real OAuth authorization code is handled
// server-side; browser receives only the independent Sandbox Auth session.
export const SANDBOX_LOGIN_ORIGIN = 'https://elevationpilot-sandbox.vercel.app';

export function isPendingSharedLogin(locationLike) {
  if (!locationLike || locationLike.origin !== SANDBOX_LOGIN_ORIGIN ||
      locationLike.pathname !== '/') return false;
  return new URLSearchParams(locationLike.search || '').get('sandbox_sso') === 'complete';
}

export async function claimSharedLogin(client, {enabled = false, locationLike, fetcher} = {}) {
  if (!enabled || !isPendingSharedLogin(locationLike) ||
      !client?.auth?.setSession || typeof fetcher !== 'function') return {ok:false};
  try {
    const response = await fetcher('/api/sandbox-sso/claim', {
      method: 'POST', credentials: 'same-origin',
      headers: {'Content-Type':'application/json', 'X-EIG-Sandbox-Claim':'1'},
      body: '{}', cache:'no-store', redirect:'error'
    });
    if (!response.ok) return {ok:false};
    const session = await response.json();
    if (!session || typeof session.access_token !== 'string' ||
        typeof session.refresh_token !== 'string') return {ok:false};
    const {data, error} = await client.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    return {ok: !error && !!data?.session};
  } catch {
    return {ok:false};
  }
}
