import React, { useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';

const EIG_SLUG = 'elevated-impact-group';
const GOLF_REGISTRATION_URL = 'https://golf-event-registrations-eig.vercel.app';

function LoadingScreen({ message = 'Loading EIG Platform...' }) {
  return (
    <div className="platform-auth-screen">
      <div className="platform-login-card compact">
        <div className="platform-logo-mark">EIG</div>
        <h1>{message}</h1>
      </div>
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    setBusy(false);
  }

  return (
    <div className="platform-auth-screen">
      <div className="platform-login-card">
        <div className="platform-logo-mark">EIG</div>
        <p className="platform-eyebrow">Elevated Impact Group</p>
        <h1>One login. Every EIG workspace.</h1>
        <p className="platform-login-copy">
          Sign in to access the organizations, products, events, and tools assigned to your account.
        </p>
        <form onSubmit={submit} className="platform-login-form">
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required />
          </label>
          {error && <div className="platform-error">{error}</div>}
          <button className="platform-primary-button" disabled={busy} type="submit">
            {busy ? 'Signing in...' : 'Sign in to EIG'}
          </button>
        </form>
      </div>
    </div>
  );
}

function WorkspaceSwitcher({ memberships, activeOrganizationId, onSelect }) {
  return (
    <select
      className="platform-workspace-select"
      value={activeOrganizationId || ''}
      onChange={(e) => onSelect(e.target.value)}
      aria-label="Choose workspace"
    >
      {memberships.map((membership) => (
        <option key={membership.organization_id} value={membership.organization_id}>
          {membership.organization?.name || 'Workspace'}
        </option>
      ))}
    </select>
  );
}

function PlatformShell({ user, memberships, activeOrganizationId, setActiveOrganizationId, children, onSignOut }) {
  const active = memberships.find((m) => m.organization_id === activeOrganizationId);
  return (
    <div className="platform-shell">
      <header className="platform-topbar">
        <div className="platform-brand-wrap">
          <div className="platform-logo-mark small">EIG</div>
          <div>
            <strong>Elevated Impact Group</strong>
            <span>{active?.organization?.name || 'Platform'}</span>
          </div>
        </div>
        <div className="platform-topbar-actions">
          <WorkspaceSwitcher
            memberships={memberships}
            activeOrganizationId={activeOrganizationId}
            onSelect={setActiveOrganizationId}
          />
          <div className="platform-user-block">
            <span>{user?.email}</span>
            <button onClick={onSignOut}>Sign out</button>
          </div>
        </div>
      </header>
      <main className="platform-main-content">{children}</main>
    </div>
  );
}

function StatCard({ label, value, detail }) {
  return (
    <div className="platform-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function EigAdminDashboard({ organizations, products, onOpenOrganization, loading }) {
  const clients = organizations.filter((org) => org.slug !== EIG_SLUG);
  const activeProducts = products.filter((product) => product.status === 'active').length;
  return (
    <div className="platform-page">
      <section className="platform-hero">
        <div>
          <p className="platform-eyebrow">EIG Master Workspace</p>
          <h1>Platform Control Center</h1>
          <p>Manage client organizations, product access, and the growing EIG ecosystem from one place.</p>
        </div>
        <div className="platform-role-pill">EIG Admin</div>
      </section>

      <section className="platform-stats-grid">
        <StatCard label="Client Organizations" value={clients.length} detail="Organizations managed by EIG" />
        <StatCard label="Products in Catalog" value={products.length} detail={`${activeProducts} currently active`} />
        <StatCard label="Platform Status" value="Live" detail="Shared authentication + entitlements" />
      </section>

      <section className="platform-section-card">
        <div className="platform-section-heading">
          <div>
            <p className="platform-eyebrow">Clients</p>
            <h2>Organizations</h2>
          </div>
          <button className="platform-secondary-button" disabled title="Next build step">+ Add Organization</button>
        </div>
        {loading ? <p>Loading organizations...</p> : (
          <div className="platform-org-grid">
            {clients.map((org) => (
              <button key={org.id} className="platform-org-card" onClick={() => onOpenOrganization(org.id)}>
                <div className="platform-org-icon">{org.name?.slice(0, 2).toUpperCase()}</div>
                <div>
                  <strong>{org.name}</strong>
                  <span>{org.organization_type?.replaceAll('_', ' ') || 'Organization'}</span>
                </div>
                <b>Open →</b>
              </button>
            ))}
            {!clients.length && <p>No client organizations found yet.</p>}
          </div>
        )}
      </section>
    </div>
  );
}

function ProductCard({ product, enabled, onLaunch }) {
  const comingSoon = product.status === 'coming_soon';
  return (
    <div className={`platform-product-card ${enabled ? 'enabled' : ''}`}>
      <div className="platform-product-topline">
        <span>{product.category || 'EIG Product'}</span>
        <span className={`platform-status-pill ${enabled ? 'enabled' : comingSoon ? 'soon' : ''}`}>
          {enabled ? 'Enabled' : comingSoon ? 'Coming Soon' : 'Not Enabled'}
        </span>
      </div>
      <h3>{product.name}</h3>
      <p>{product.description}</p>
      {enabled && product.product_key === 'golf_event_registration' && (
        <button className="platform-primary-button inline" onClick={onLaunch}>Open Golf Event Registration</button>
      )}
    </div>
  );
}

function OrganizationDashboard({ organization, role, products, entitlements, onLaunchGolfRegistration }) {
  const enabledIds = useMemo(() => new Set(entitlements.filter((e) => ['active', 'trial'].includes(e.status)).map((e) => e.product_id)), [entitlements]);
  const enabledCount = enabledIds.size;

  return (
    <div className="platform-page">
      <section className="platform-hero organization">
        <div>
          <p className="platform-eyebrow">Organization Workspace</p>
          <h1>{organization?.name || 'Organization'}</h1>
          <p>Your EIG products, event tools, network, billing, and future services will live here.</p>
        </div>
        <div className="platform-role-pill">{role?.replaceAll('_', ' ') || 'member'}</div>
      </section>

      <section className="platform-stats-grid">
        <StatCard label="Enabled Products" value={enabledCount} detail="Purchased or assigned by EIG" />
        <StatCard label="EIG Credits" value="$0.00" detail="Credit ledger connected; balance UI next" />
        <StatCard label="Workspace" value="Active" detail="One login across enabled products" />
      </section>

      <section className="platform-section-card">
        <div className="platform-section-heading">
          <div>
            <p className="platform-eyebrow">Your EIG Products</p>
            <h2>Products & Tools</h2>
          </div>
        </div>
        <div className="platform-product-grid">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              enabled={enabledIds.has(product.id)}
              onLaunch={onLaunchGolfRegistration}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [memberships, setMemberships] = useState([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState('');
  const [products, setProducts] = useState([]);
  const [entitlements, setEntitlements] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState('');

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      if (!nextSession) {
        setMemberships([]);
        setActiveOrganizationId('');
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    loadMemberships(session.user.id);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!activeOrganizationId) return;
    loadWorkspaceData(activeOrganizationId);
  }, [activeOrganizationId]);

  async function loadMemberships(userId) {
    setLoadingData(true);
    setDataError('');
    const { data, error } = await supabase
      .from('organization_memberships')
      .select('organization_id, role, status, organization:organizations(id,name,slug,organization_type,status)')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      setDataError(error.message);
      setMemberships([]);
      setLoadingData(false);
      return;
    }

    const ordered = [...(data || [])].sort((a, b) => {
      if (a.organization?.slug === EIG_SLUG) return -1;
      if (b.organization?.slug === EIG_SLUG) return 1;
      return (a.organization?.name || '').localeCompare(b.organization?.name || '');
    });
    setMemberships(ordered);
    setActiveOrganizationId((current) => current || ordered[0]?.organization_id || '');
    setLoadingData(false);
  }

  async function loadWorkspaceData(organizationId) {
    setLoadingData(true);
    setDataError('');
    const activeMembership = memberships.find((m) => m.organization_id === organizationId);
    const isEig = activeMembership?.organization?.slug === EIG_SLUG && activeMembership?.role === 'eig_admin';

    const [{ data: productRows, error: productError }, { data: entitlementRows, error: entitlementError }] = await Promise.all([
      supabase.from('products').select('*').neq('status', 'retired').order('sort_order'),
      supabase.from('organization_product_entitlements').select('*').eq('organization_id', organizationId),
    ]);

    if (productError || entitlementError) {
      setDataError(productError?.message || entitlementError?.message || 'Unable to load workspace data.');
    }
    setProducts(productRows || []);
    setEntitlements(entitlementRows || []);

    if (isEig) {
      const { data: orgRows, error: orgError } = await supabase.from('organizations').select('*').order('name');
      if (orgError) setDataError(orgError.message);
      setOrganizations(orgRows || []);
    } else {
      setOrganizations([]);
    }
    setLoadingData(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="platform-auth-screen">
        <div className="platform-login-card">
          <div className="platform-logo-mark">EIG</div>
          <h1>Supabase environment variables are missing.</h1>
          <p>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel, then redeploy.</p>
        </div>
      </div>
    );
  }

  if (!authReady) return <LoadingScreen />;
  if (!session) return <LoginScreen />;
  if (loadingData && !memberships.length) return <LoadingScreen message="Opening your workspaces..." />;

  if (!memberships.length) {
    return (
      <div className="platform-auth-screen">
        <div className="platform-login-card">
          <div className="platform-logo-mark">EIG</div>
          <h1>No active workspace found.</h1>
          <p>Your login is valid, but it does not currently have an active EIG organization membership.</p>
          {dataError && <div className="platform-error">{dataError}</div>}
          <button className="platform-secondary-button" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }

  const activeMembership = memberships.find((m) => m.organization_id === activeOrganizationId) || memberships[0];
  const activeOrganization = activeMembership?.organization;
  const isEigAdminWorkspace = activeOrganization?.slug === EIG_SLUG && activeMembership?.role === 'eig_admin';


  return (
    <PlatformShell
      user={session.user}
      memberships={memberships}
      activeOrganizationId={activeOrganizationId}
      setActiveOrganizationId={(id) => {
        setActiveOrganizationId(id);
      }}
      onSignOut={signOut}
    >
      {dataError && <div className="platform-error banner">{dataError}</div>}
      {isEigAdminWorkspace ? (
        <EigAdminDashboard
          organizations={organizations}
          products={products}
          loading={loadingData}
          onOpenOrganization={setActiveOrganizationId}
        />
      ) : (
        <OrganizationDashboard
          organization={activeOrganization}
          role={activeMembership?.role}
          products={products}
          entitlements={entitlements}
          onLaunchGolfRegistration={() => {
            window.location.href = GOLF_REGISTRATION_URL;
          }}
        />
      )}
    </PlatformShell>
  );
}
