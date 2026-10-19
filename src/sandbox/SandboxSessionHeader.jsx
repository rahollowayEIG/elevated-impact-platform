import React from 'react';
import { createPortal } from 'react-dom';
import { getSandboxSessionLabel } from './sandboxSessionLabel.mjs';

/**
 * Mirrors Live's account/role context without accessing any Live profile.
 * Render only after the SandboxAccessGate has independently verified both the
 * isolated Auth identity and the active practice role via server-owned RPC.
 * Uses a portal into the Sandbox-only top bar instead of duplicating Auth
 * queries or adding global client permissions.
 */
export default function SandboxSessionHeader({ email, activeRole }) {
  const identity = getSandboxSessionLabel(email, activeRole);
  if (!identity) return null;
  const slot = document.getElementById('sandbox-session-header-slot');
  if (!slot) return null;

  return createPortal(
    <div className="eig-sandbox-session" role="status"
      aria-label={`Sandbox account ${identity.email}. Active practice role: ${identity.role}.`}
      data-testid="sandbox-session-header"
      title={identity.email}>
      <span className="eig-sandbox-session-account">
        <span className="eig-sandbox-session-account-label">Signed in</span>
        <strong className="eig-sandbox-session-handle">{identity.handle}</strong>
      </span>
      <span className="eig-sandbox-session-role">{identity.role}</span>
    </div>,
    slot
  );
}
