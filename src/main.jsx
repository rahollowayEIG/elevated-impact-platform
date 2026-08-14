import React from 'react';
import { createRoot } from 'react-dom/client';
import ElevatedImpactPhaseOneFrontend from './App.jsx';
import './styles.css';

const EIG_ICON = 'https://raw.githubusercontent.com/rahollowayEIG/elevated-impact-group-site/main/assets/eig-header-icon.png';

function EIGAppHeader() {
  return (
    <>
      <style>{`
        .eig-global-header{min-height:64px;padding:12px 24px;display:flex;align-items:center;background:#07111f;border-bottom:1px solid rgba(255,255,255,.08)}
        .eig-global-home{display:inline-flex;align-items:center;gap:10px;color:#eef2f7;text-decoration:none;font-weight:900;letter-spacing:.02em}
        .eig-global-home img{width:58px;height:40px;object-fit:contain;display:block}
        .eig-global-home span{white-space:nowrap}
        .platform-topbar .platform-brand-wrap{display:none}
        @media(max-width:720px){.eig-global-header{min-height:54px;padding:9px 14px}.eig-global-home img{width:50px;height:34px}.eig-global-home span{display:none}}
      `}</style>
      <header className="eig-global-header">
        <a className="eig-global-home" href="/" aria-label="EIG Platform home">
          <img src={EIG_ICON} alt="Elevated Impact Group" />
          <span>Elevated Impact Group</span>
        </a>
      </header>
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <EIGAppHeader />
    <ElevatedImpactPhaseOneFrontend />
  </React.StrictMode>
);
