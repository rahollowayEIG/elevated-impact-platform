/**
 * All identities are fictional and belong ONLY to the separate sandbox.
 * This is presentation metadata; never interpret a selected persona as an
 * authenticated session or as authorization to access any data.
 */
export const SANDBOX_DEMO_PERSONAS = Object.freeze([
  { code: 'eig_admin', name: 'Alex Demo', email: 'alex@sandbox.invalid', role: 'EIG Administrator', scope: 'Platform', username: 'sandbox_alex' },
  { code: 'pilot', name: 'Jordan Demo', email: 'jordan@sandbox.invalid', role: 'Pilot', scope: 'Practice Club', username: 'sandbox_jordan' },
  { code: 'co_pilot', name: 'Taylor Demo', email: 'taylor@sandbox.invalid', role: 'Co-Pilot', scope: 'Practice Club', username: 'sandbox_taylor' },
  { code: 'atc', name: 'Morgan Demo', email: 'morgan@sandbox.invalid', role: 'ATC Coordinator', scope: 'Practice Scramble', username: 'sandbox_morgan' },
  { code: 'passenger', name: 'Casey Demo', email: 'casey@sandbox.invalid', role: 'Passenger', scope: 'Own registrations', username: 'sandbox_casey' },
]);
