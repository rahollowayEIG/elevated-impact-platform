// Presentation-only launch selector for installed desktop PWAs.
// This never confers access: server-side owner/role grants remain mandatory.
export function desktopAppFromLaunch({ standalone = false, search = '' } = {}) {
  if (standalone !== true) return null;
  const params = new URLSearchParams(search);
  if (params.get('buildlab') === '1') return 'build_lab';
  return null;
}

// Display-only decision. A manual preference covers Chrome's generic "install page as app"
// windows when Vercel preview protection prevents the manifest from loading.
export function shouldFocusBuildLab({ standalone = false, preference = null } = {}) {
  return typeof preference === 'boolean' ? preference : standalone === true;
}
