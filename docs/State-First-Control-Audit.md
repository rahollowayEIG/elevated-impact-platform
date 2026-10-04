# State-first account controls

## Scope and action contract

This change converts the existing Deactivate/Reactivate and Disable/Unlock action pairs in User Management into two independent fixed-label switches. The state block is above the action menu, and directory/detail badges show both statuses. It does not introduce another identity, a new permission model, or a combined unlock/reactivate operation.

- Account active: On = profiles.account_status is active; Off = deactivated. This is the administrative platform status.
- Sign-in unlocked: On = Auth banned_until is absent/null or expired; Off = a future security ban. Missing/unparseable returned fields are Unknown, not fabricated On.
- Clicking a switch opens a significant-change confirmation with the target email and before/after states. The original switch remains unchanged until a successful write and readback for that same target ID.
- Before writing, re-read the directory and reject a stale confirmation. After an uncertain write, block further changes until an explicit refresh. Never automatically retry the mutation.
- Self-account changes are disabled in the UI as well as subject to the existing backend restrictions. The existing admin_security endpoint still enforces authorization.
- Confirmation focus starts on Cancel; Escape cancels only when not saving. The modal traps focus through native dialog behavior and returns focus to the initiating control. Keyboard, reduced-motion and high-contrast considerations are included.

## Communication

No email, SMS or Squawk is sent by these four existing security/status operations. The confirmation says so. This UI conversion does not silently add notifications, reset passwords, or build the separate reactivation-request workflow. That workflow and EIG/applicable Pilot notification requirements remain open.

## Conversion inventory

| Existing control | Decision |
| --- | --- |
| Deactivate / Reactivate | Converted to Account active switch |
| Disable / Unlock | Converted to Sign-in unlocked switch |
| Verification and test designation | Read-only facts remain explicit; verification cannot be toggled manually |
| Mark Test / Remove Test | Not opposites: removal deletes the account. No false reversible toggle; safe unmark support is a separate backend task |
| Manage roles/access | Navigation and multi-state, scoped/date-bound editor remain separate; do not turn expiry into an unlimited permission switch |
| Reset password / Account recovery / Resend verification | Commands that send messages, not states |
| Sign Out All Sessions | One-way command, still unavailable |
| Merge, claim, delete | Not simple reversible states; remain separate |

The shared StateSwitch component and fixed-label rule are available for future applicable EIG pages. This is not a claim that every app has been converted.

## Known limitations discovered during review

The existing deactivate/reactivate backend only writes profiles.account_status. This patch does not establish platform-wide enforcement for that field, and the UI must not describe it as proof that login or API access has been blocked. The independent security restriction controls sign-in. Likewise, unlocking does not override role/date/verification restrictions or imply every session has been revoked.

The current admin_security endpoint logs successful operations to function logs. Durable before/after audit records, atomic compare-and-set protection against simultaneous administrators, and disabled/deactivated audit-list integration remain separate backend follow-ups. This frontend re-read is a usability safety check, not a replacement for transactional authorization. No central audit coverage is claimed complete by this change.

## Verification

Unit tests exercise four combinations, stale/missing data, wrong target, self-change rejection and uncertain writes. Browser tests render the actual User Management component with synthetic endpoint responses only, checking Cancel, readback, all four directions, failure, duplicate clicks, keyboard and mobile layout. Existing password-recovery regression tests must also pass. No live users, passwords, security restrictions, schemas or email settings are changed by test execution.

Human acceptance: inspect the two switches on the designated test record; cancel once; optionally perform an authorized test-state change and refresh. Keep the real password-recovery acceptance test separate. Do not use a real user or the current administrator for toggle testing.

References: https://www.w3.org/WAI/ARIA/apg/patterns/switch/ and https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ .
