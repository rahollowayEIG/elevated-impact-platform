import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const path = 'src/PlatformApp.jsx';
let source = readFileSync(path, 'utf8');
const sha = createHash('sha1').update(`blob ${Buffer.byteLength(source)}\0`).update(source).digest('hex');
assert.equal(sha, '307fd78064a3345677b90f81824044aa37601ef0', 'Source changed: review the patch rather than overwriting concurrent work.');
function once(text, oldText, newText) {
  assert.equal(text.split(oldText).length - 1, 1, `Expected one patch target: ${oldText.slice(0, 100)}`);
  return text.replace(oldText, newText);
}
source = "import AccountStateControls, { AccountStateBadges } from './components/AccountStateControls.jsx';\n" + source;
const start = source.indexOf('function EigUserManagement(');
const end = source.indexOf('\nfunction EigAdminDashboard(', start);
assert.ok(start > 0 && end > start);
let block = source.slice(start, end);
block = once(block, 'function EigUserManagement({ onBack, onInviteUser })', 'function EigUserManagement({ onBack, onInviteUser, currentUserId })');
for (const line of ["  const [securityAction, setSecurityAction] = useState(null);\n", "  const [securityBusy, setSecurityBusy] = useState(false);\n", "  const [securityError, setSecurityError] = useState('');\n"]) block = once(block, line, '');
const fnStart = block.indexOf('  async function securityActionConfirm() {');
const fnEnd = block.indexOf('  async function testAccountAction(', fnStart);
assert.ok(fnStart > 0 && fnEnd > fnStart);
block = block.slice(0, fnStart) + block.slice(fnEnd);
const lines = block.split('\n');
let removed = 0;
block = lines.filter((line) => {
  if (line.includes("{accountStateLabel(selected) === 'Disabled' ?") || line.includes("{accountStateLabel(selected) === 'Deactivated' ?")) { removed++; return false; }
  return true;
}).join('\n');
assert.equal(removed, 2);
const modalStart = block.indexOf('      {securityAction && <div');
const modalEnd = block.indexOf('\n  </div>;', modalStart);
assert.ok(modalStart > 0 && modalEnd > modalStart);
assert.ok(block.slice(modalStart, modalEnd).includes('securityActionConfirm'));
block = block.slice(0, modalStart) + block.slice(modalEnd);
block = once(block, "<span className={'user-state ' + state.toLowerCase()}>{state}</span>", '<AccountStateBadges user={user} />');
block = once(block, "<span className={'user-state ' + accountStateLabel(selected).toLowerCase()}>{accountStateLabel(selected)}</span>", '<AccountStateBadges user={selected} />');
block = once(block, '            <div className="user-detail-actions">', `            <AccountStateControls key={selected.id} user={selected} currentUserId={currentUserId}
              invoke={(body) => supabase.functions.invoke('platform-invite', { body })}
              onSnapshot={setPayload} />
            <div className="user-detail-actions">`);
assert.equal(block.includes('securityAction'), false, 'Remove the old action implementation completely.');
source = source.slice(0, start) + block + source.slice(end);
source = once(source, '<EigUserManagement onBack=', '<EigUserManagement currentUserId={session.user.id} onBack=');
source += '\n\nexport { EigUserManagement };\n';
writeFileSync(path, source);
const packagePath = 'package.json';
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
pkg.scripts['test:account-states'] = 'node --test tests/account-state.test.mjs';
pkg.scripts.build = 'npm run test:account-states && ' + pkg.scripts.build;
writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
const rulesPath = 'docs/ElevationPilot-User-Identity-Rules.md';
let rules = readFileSync(rulesPath, 'utf8');
assert.equal(rules.includes('State-First Switch Rule'), false);
rules += `\n\n### State-First Switch Rule\n\nPrefer a fixed-label switch for a genuine two-way setting when both directions already have authorized backend behavior. Use a positive, fixed label and show the saved state in words beside the switch. On means the labeled setting is enabled, not merely that an operation was requested. Unknown, missing or stale state must never be represented as an assured Active/On state. Read-only facts such as email verification are badges, not switches.\n\nSensitive switches request an explicit confirmation identifying the immutable target account and the old/new state. Cancel leaves the state unchanged. Disable repeat submissions while saving, re-read the same target, and show the new state only after server confirmation. Reject stale confirmations and require refresh after an uncertain write; never automatically retry a toggle. Backend authorization remains authoritative.\n\nAccount lifecycle and sign-in security remain independent. An account can be Active and Locked, or Inactive and Unlocked; show both. Do not use a single display-status label to select both actions. Switching either must never silently change the other, verification, roles, dates, or passwords. Apply this consideration across EIG pages without forcing multi-state workflows, emails, money movements, deletion, merges, or irreversible actions into binary controls. See State-First-Control-Audit.md for the current conversion and explicit exclusions.\n`;
writeFileSync(rulesPath, rules);
console.log('Applied the reviewed patch. No database, account, password or provider configuration was changed.');
