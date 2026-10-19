import React from 'react';
import { createRoot } from 'react-dom/client';
import ElevatedImpactPhaseOneFrontend from './App.jsx';
import './styles.css';
import './sandbox/sandboxTheme.css';
import { installSandboxNavigationGuard } from './sandbox/sandboxNavigationGuard.mjs';
import { assertSandboxSupabaseTarget } from './sandbox/sandboxSupabaseGate.mjs';
import ActionConfirmation from './components/ActionConfirmation.jsx';
import SandboxAccessGate from './sandbox/SandboxAccessGate.jsx';
import SandboxPracticeRoles from './sandbox/SandboxPracticeRoles.jsx';
import { getSandboxBranding } from './sandbox/sandboxBranding.mjs';

const IS_SANDBOX = import.meta.env.VITE_ELEVATIONPILOT_SANDBOX === 'true';
const sandboxBranding = getSandboxBranding(IS_SANDBOX);

assertSandboxSupabaseTarget(import.meta.env.VITE_SUPABASE_URL, { enabled: IS_SANDBOX, key: import.meta.env.VITE_SUPABASE_ANON_KEY });
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
        .eig-sandbox-indicator{position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom, 0px));z-index:2147482900;display:flex;align-items:center;gap:8px;max-width:calc(100vw - 24px);padding:8px 12px;border:1px solid #a77413;border-radius:999px;background:#ffcf70;color:#242017;box-shadow:0 5px 16px rgba(0,0,0,.24);font-family:system-ui,sans-serif;font-size:12px;font-weight:900;letter-spacing:.05em;pointer-events:none}
        .eig-sandbox-indicator-detail{font-size:11px;font-weight:600;letter-spacing:0}
        .platform-topbar .platform-brand-wrap{display:none}
        @media(max-width:720px){.eig-global-header{min-height:54px;padding:9px 14px}.eig-global-home img{width:50px;height:34px}.eig-global-home-label{display:none}.eig-sandbox-indicator-detail{display:none}.eig-sandbox-indicator{padding:7px 10px;font-size:11px}}
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
          <div id="sandbox-session-header-slot" className="eig-sandbox-session-slot"
            aria-label="Current Sandbox account and practice role" />
        )}
      </header>
      {sandboxBranding && (
        <div className="eig-sandbox-indicator" role="status" aria-label="Sandbox practice environment" data-testid="sandbox-environment-indicator">
          <span aria-hidden="true">◆</span>
          <strong>{sandboxBranding.badgeLabel}</strong>
          <span className="eig-sandbox-indicator-detail">{sandboxBranding.badgeDetail}</span>
        </div>
      )}
    </>
  );
}

const SANDBOX_WORKSPACE_ENABLED = import.meta.env.VITE_SANDBOX_WORKSPACE_ENABLED === 'true';

// App APIs, payments, mail, Drive, embeds and outgoing Live links must pass
// independent Sandbox integration checks before enabling this last gate.
function SandboxWorkspaceStaging() {
  return (
    <main style={{ maxWidth: 640, padding: '44px 24px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <section style={{ padding: 28, borderRadius: 16, border: '2px solid #ed9fcf', background: 'white', color: '#361333' }}>
        <p style={{ fontSize: 12, letterSpacing: 2, color: '#a21e62', fontWeight: 800 }}>SANDBOX VERIFIED</p>
        <h1>Welcome to your practice workspace.</h1>
        <p>Your sandbox identity was approved. You can use the practice-role control to test authorized role switching.</p>
        <p><strong>Full app workflows are locked for now</strong> while we isolate the remaining registration, payment, messaging and marketing integrations.</p>
        <p>Nothing here can operate your Live data or send real customer communications.</p>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <EIGAppHeader />
    {IS_SANDBOX ? (
      <SandboxAccessGate>
        {SANDBOX_WORKSPACE_ENABLED ? <ElevatedImpactPhaseOneFrontend /> : <SandboxWorkspaceStaging />}
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
