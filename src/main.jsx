import React from 'react';
import { createRoot } from 'react-dom/client';
import ElevatedImpactPhaseOneFrontend from './App.jsx';
import './styles.css';
import './sandbox/sandboxTheme.css';
import { installSandboxNavigationGuard } from './sandbox/sandboxNavigationGuard.mjs';
import { installSandboxBrowserFetchGuard } from './sandbox/sandboxBrowserFetchGuard.mjs';
import { installSandboxReadOnlyActionsGuard } from './sandbox/sandboxReadOnlyActionsGuard.mjs';
import { assertSandboxSupabaseTarget } from './sandbox/sandboxSupabaseGate.mjs';
import ActionConfirmation from './components/ActionConfirmation.jsx';
import SandboxAccessGate from './sandbox/SandboxAccessGate.jsx';
import SandboxPracticeRoles from './sandbox/SandboxPracticeRoles.jsx';
import { getSandboxBranding } from './sandbox/sandboxBranding.mjs';

const IS_SANDBOX = import.meta.env.VITE_ELEVATIONPILOT_SANDBOX === 'true';
const SANDBOX_WORKSPACE_ENABLED = import.meta.env.VITE_SANDBOX_WORKSPACE_ENABLED === 'true';
const SANDBOX_READONLY_PREVIEW_ENABLED = IS_SANDBOX && !SANDBOX_WORKSPACE_ENABLED &&
  import.meta.env.VITE_SANDBOX_READONLY_PREVIEW_ENABLED === 'true';
const SANDBOX_READONLY_REQUESTED = SANDBOX_READONLY_PREVIEW_ENABLED &&
  new URLSearchParams(window.location.search).get('sandbox_readonly') === '1';
const sandboxBranding = getSandboxBranding(IS_SANDBOX);

assertSandboxSupabaseTarget(import.meta.env.VITE_SUPABASE_URL, { enabled: IS_SANDBOX, key: import.meta.env.VITE_SUPABASE_ANON_KEY });
// Browser fetch requests must stay on this Sandbox origin or its isolated
// Supabase service. This is defense in depth; all app workflows remain locked
// until their API, XHR, redirect and outbound integration review is complete.
installSandboxBrowserFetchGuard({
  enabled: IS_SANDBOX,
  readOnly: SANDBOX_READONLY_PREVIEW_ENABLED,
  sandboxSupabaseUrl: import.meta.env.VITE_SUPABASE_URL,
});
installSandboxReadOnlyActionsGuard({
  enabled: SANDBOX_READONLY_PREVIEW_ENABLED,
  sandboxSupabaseUrl: import.meta.env.VITE_SUPABASE_URL,
});
installSandboxNavigationGuard({ enabled: IS_SANDBOX });
if (IS_SANDBOX) document.documentElement.classList.add('elevationpilot-sandbox');
if (sandboxBranding) document.title = sandboxBranding.pageTitle;

const EIG_ICON = 'https://raw.githubusercontent.com/rahollowayEIG/elevated-impact-group-site/main/assets/eig-header-icon.png';

function EIGAppHeader() {
  return (
    <>
      <style>{`
        .eig-global-header{min-height:64px;padding:12px 24px;display:flex;align-items:center;background:#07111f;border-bottom:1px solid rgba(255,255,255,.08)}
        .eig-global-home{display:inline-flex;align-items:center;gap:10px;color:#eef2f7;text-decoration:none;font-weight:900;letter-spacing:.02em}
        .eig-global-home img{width:58px;height:40px;object-fit:contain;display:block}
        .eig-global-home span{white-space:nowrap}
        .eig-global-home-label{display:flex;flex-direction:column;gap:3px;line-height:1.1}
        .eig-global-home-subtitle{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#ffcd69}
        .platform-topbar .platform-brand-wrap{display:none}
        @media(max-width:720px){.eig-global-header{min-height:54px;padding:9px 14px}.eig-global-home img{width:50px;height:34px}.eig-global-home-label{display:none}}
      `}</style>
      <header className="eig-global-header">
        <a className="eig-global-home" href="/" aria-label={IS_SANDBOX ? "ElevationPilot Sandbox home" : "EIG Platform home"}>
          <img src={EIG_ICON} alt="Elevated Impact Group" />
          <span className="eig-global-home-label">
            Elevated Impact Group
            {sandboxBranding && <small className="eig-global-home-subtitle">{sandboxBranding.homeSubtitle}</small>}
          </span>
        </a>
        {IS_SANDBOX && (
          <div className="eig-sandbox-header-actions">
            <span className="eig-sandbox-mode-label" title="Training and demonstrations only">SANDBOX</span>
            <div id="sandbox-session-header-slot" className="eig-sandbox-session-slot"
              aria-label="Current Sandbox account and practice role" />
            <div id="sandbox-practice-controls-slot" className="eig-sandbox-controls-slot"
              aria-label="Sandbox practice role controls" />
          </div>
        )}
      </header>
    </>
  );
}

// App APIs, payments, mail, Drive, embeds and outgoing Live links must pass
// independent Sandbox integration checks before enabling this last gate.
function SandboxReadOnlyPreview() {
  return <>
    <aside role="status" style={{ background: '#421038', color: '#fff', padding: '11px 18px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <strong>SANDBOX · READ-ONLY UI TEST</strong>
      {' '} Existing ElevationPilot screens and isolated practice data. Saving, payments, outgoing messages and other integrations are disabled.
      {' '} <a href="/" style={{ color: '#fff', fontWeight: 800 }}>Exit preview</a>
    </aside>
    <ElevatedImpactPhaseOneFrontend />
  </>;
}

function SandboxWorkspaceStaging() {
  return (
    <main style={{ maxWidth: 640, padding: '44px 24px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <section style={{ padding: 28, borderRadius: 16, border: '2px solid #ed9fcf', background: 'white', color: '#361333' }}>
        <p style={{ fontSize: 12, letterSpacing: 2, color: '#a21e62', fontWeight: 800 }}>SANDBOX VERIFIED</p>
        <h1>Welcome to your practice workspace.</h1>
        <p>Your sandbox identity was approved. You can use the practice-role control to test authorized role switching.</p>
        <p><strong>Full app workflows are locked for now</strong> while we isolate the remaining registration, payment, messaging and marketing integrations.</p>
        <p>Nothing here can operate your Live data or send real customer communications.</p>
        {SANDBOX_READONLY_PREVIEW_ENABLED && (
          <p>
            <a href="/?sandbox_readonly=1" style={{ display: 'inline-block', padding: '12px 16px', borderRadius: 8, background: '#a31361', color: '#fff', fontWeight: 800, textDecoration: 'none' }}>
              Inspect existing ElevationPilot screens (read-only) →
            </a>
          </p>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <EIGAppHeader />
    {IS_SANDBOX ? (
      <SandboxAccessGate>
        {SANDBOX_WORKSPACE_ENABLED
          ? <ElevatedImpactPhaseOneFrontend />
          : SANDBOX_READONLY_REQUESTED
            ? <SandboxReadOnlyPreview />
            : <SandboxWorkspaceStaging />}
        <ActionConfirmation />
        <SandboxPracticeRoles />
      </SandboxAccessGate>
    ) : (
      <>
        <ElevatedImpactPhaseOneFrontend />
        <ActionConfirmation />
      </>
    )}
  </React.StrictMode>
);
