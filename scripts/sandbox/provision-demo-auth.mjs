#!/usr/bin/env node
/**
 * DEPRECATED. Sandbox is now one approved tester login with server-assigned
 * practice roles. Never create five fictional Auth accounts, and never grant
 * EIG Administrator in a customer-facing practice environment.
 *
 * This legacy entry point is intentionally inert even with --provision,
 * service role secrets or any other flags. Do not use it to create users.
 *
 * First tester: Supabase Authentication > Users > Invite User, in the
 * isolated ElevationPilot-Sandbox project only, after Auth/email review.
 * Then enroll the verified user using operator-reviewed instructions at:
 * docs/SANDBOX_FIRST_TESTER_ACTIVATION.md
 */
const message = 'Legacy five-persona Auth provisioning is disabled. Use the approved single-tester Sandbox enrollment workflow.';
if (process.argv.includes('--provision')) {
  console.error('REFUSED: ' + message);
  process.exitCode = 1;
} else {
  console.log('Dry run: ' + message + ' No users or memberships were created.');
}
