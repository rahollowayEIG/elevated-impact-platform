// Presentation-only launcher. Vercel SSO can block the install manifest,
// causing Chrome's "install page as app" shortcut to open the root URL.
// On this Build Lab-only preview, a standalone root launch is Build Lab.
// An explicit ?buildlab=1 works in an ordinary browser as well.
// This does not grant access: protected server-side owner checks still apply.
export function desktopAppFromLaunch({ standalone = false, search = '', previewEnabled = false } = {}) {
  if (!previewEnabled) return null;
  const params = new URLSearchParams(search);
  if (params.has('buildlab')) return params.get('buildlab') === '1' ? 'build_lab' : null;
  if (['app', 'team_invite', 'recovery', 'type'].some((key) => params.has(key))) return null;
  return standalone === true ? 'build_lab' : null;
}

// Display-only decision. A manual preference covers Chrome's generic "install page as app"
// windows when Vercel preview protection prevents the manifest from loading.
export function shouldFocusBuildLab({ standalone = false, preference = null } = {}) {
  return typeof preference === 'boolean' ? preference : standalone === true;
}

// Navigation planner is UI-only. It cannot authorize a Build Lab session.
// The server must grant the exact owner access before any workspace switch.
export function buildLabLaunchStep({
  requested = false, ready = false, userId = '', grant = null,
  eigOrganizationId = '', activeOrganizationId = '',
  portalView = '', adminView = '',
} = {}) {
  if (!requested || !ready || !userId || !eigOrganizationId ||
      grant?.allowed !== true || grant?.userId !== userId) return 'wait';
  if (activeOrganizationId !== eigOrganizationId || portalView !== 'workspace') return 'enter_eig_workspace';
  return adminView === 'build_lab' ? 'complete' : 'open_build_lab';
}
