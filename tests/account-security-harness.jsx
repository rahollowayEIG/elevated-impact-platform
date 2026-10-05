import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import AccountSecurityHistory from '../src/components/AccountSecurityHistory.jsx';
import '../src/components/state-controls.css';
import '../src/styles.css';
const target = { id: '11111111-1111-4111-8111-111111111111', email: 'avery@example.test', profile: { display_name: 'Avery Tester', username: 'avery_one' } };
const second = { ...target, id: '22222222-2222-4222-8222-222222222222', email: 'other@example.test', profile: { ...target.profile, username: 'avery_two' } };
window.securityFixture = { calls: [], fail: false, historyFail: false, delay: 0, entries: [
  { id: 'one', action: 'account_status_changed', outcome: 'completed', actor_label: 'Ryan', actor_user_id: 'admin', created_at: '2026-10-04T12:00:00Z', before_state: { account_status: 'active' }, after_state: { account_status: 'deactivated' } },
  { id: 'two', action: 'organization_memberships_changed', outcome: 'completed', actor_label: 'Kellie', actor_user_id: 'admin-two', created_at: '2026-10-05T12:00:00Z', before_state: { role: 'organization_staff' }, after_state: { role: 'organization_admin' } },
] };
function App() {
  const [user, setUser] = useState(target);
  const [self, setSelf] = useState(false);
  window.selectSecurityTarget = (which) => setUser(which === 2 ? second : target);
  window.setSecuritySelf = setSelf;
  async function invoke(body) {
    const fixture = window.securityFixture;
    fixture.calls.push(body);
    if (fixture.delay) await new Promise((resolve) => setTimeout(resolve, fixture.delay));
    if (body.action === 'admin_account_history') {
      if (fixture.historyFail) return { error: { message: 'Edge Function returned a non-2xx status code', context: new Response(JSON.stringify({ error: 'Synthetic history failure' }), { status: 500 }) } };
      return { data: { success: true, entries: fixture.entries } };
    }
    if (fixture.fail) return { data: { success: false, error: 'Synthetic network uncertainty' } };
    fixture.entries = [...fixture.entries, { id: crypto.randomUUID(), action: 'sessions_revoked', outcome: 'completed', actor_label: 'Ryan', created_at: new Date().toISOString(), reason: body.reason, after_state: { sessions_revoked: 2 } }];
    return { data: { success: true, user_id: body.target_user_id, sessions_revoked: 2 } };
  }
  return <main style={{ maxWidth: 760, margin: '20px auto', padding: 16 }}><h1>User Management security test</h1><AccountSecurityHistory key={user.id} user={user} currentUserId={self ? user.id : 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'} invoke={invoke} /></main>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
