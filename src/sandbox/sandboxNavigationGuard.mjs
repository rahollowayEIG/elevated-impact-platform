/**
 * A last-line-of-defense for ordinary clicks and form submissions in the
 * protected sandbox. Does not intercept window.location assignments, fetch,
 * server webhooks or programmatic API requests. Those need separate checks.
 */
export function isAllowedSandboxDestination(destination, baseUrl) {
  if (destination == null || String(destination).trim() === '') return true;
  try {
    const base = new URL(baseUrl);
    const target = new URL(String(destination), base);
    return ['https:', 'http:'].includes(target.protocol) && target.origin === base.origin;
  } catch {
    return false;
  }
}

export function installSandboxNavigationGuard({ enabled = false, windowObject, documentObject } = {}) {
  if (!enabled) return () => {};
  const win = windowObject ?? window;
  const doc = documentObject ?? document;
  const baseUrl = win.location.href;

  function displayBlockedNotice() {
    let notice = doc.getElementById('elevationpilot-sandbox-navigation-notice');
    if (!notice) {
      notice = doc.createElement('div');
      notice.id = 'elevationpilot-sandbox-navigation-notice';
      notice.setAttribute('role', 'alert');
      Object.assign(notice.style, {
        position: 'fixed', bottom: '18px', left: '18px', right: '18px',
        margin: '0 auto', maxWidth: '560px', padding: '14px 18px',
        background: '#1D245D', color: 'white', borderRadius: '12px',
        zIndex: '2147483647', boxShadow: '0 8px 24px rgba(0,0,0,.25)',
        fontFamily: 'system-ui, sans-serif', fontSize: '14px'
      });
      doc.body.appendChild(notice);
    }
    notice.textContent = 'Practice mode: external navigation is disabled to protect the live system.';
  }

  function deny(event) {
    event.preventDefault();
    event.stopImmediatePropagation?.();
    displayBlockedNotice();
  }

  function clickHandler(event) {
    const anchor = event.target?.closest?.('a[href]');
    if (anchor && !isAllowedSandboxDestination(anchor.getAttribute('href'), baseUrl)) deny(event);
  }

  function submitHandler(event) {
    const form = event.target;
    if (!form?.getAttribute) return;
    const action = form.getAttribute('action');
    if (!isAllowedSandboxDestination(action, baseUrl)) deny(event);
  }

  doc.addEventListener('click', clickHandler, true);
  doc.addEventListener('submit', submitHandler, true);
  return () => {
    doc.removeEventListener('click', clickHandler, true);
    doc.removeEventListener('submit', submitHandler, true);
  };
}
