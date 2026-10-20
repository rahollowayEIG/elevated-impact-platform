// Presentation-only launch selector for installed desktop PWAs.
// This never confers access: server-side owner/role grants remain mandatory.
export function desktopAppFromLaunch({ standalone = false, search = '' } = {}) {
  if (standalone !== true) return null;
  const params = new URLSearchParams(search);
  if (params.get('buildlab') === '1') return 'build_lab';
  return null;
}
