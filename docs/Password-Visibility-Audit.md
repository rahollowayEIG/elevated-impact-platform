# Password Visibility Control Audit

**Status:** implementation candidate in the post-recovery safety pull request  
**Scope:** active ElevationPilot sign-in, account creation, invitation account setup, password recovery, password confirmation, and the explicit post-recovery account-switch sign-in.

## Purpose

Provide an accessible show/hide control for password fields so a user can verify what they typed without changing authentication, recovery, account, role, or session behavior.

## Behavior

- Password text is hidden by default.
- Each password field has its own independent visibility control.
- The control is a non-submit button with an accessible Show/Hide label and pressed state.
- Revealing one field does not reveal another field.
- Password text re-hides when the browser window loses focus and whenever the field is disabled.
- The control only changes the local input presentation. It does not send email, Squawk, SMS, analytics, or another notification.
- The control never reads an existing password from the server, browser storage, or an administrator view.
- Existing autocomplete semantics remain attached to each password input.

## Risk and audit coverage

This is a Level 1 presentation control. It does not create a durable account state or operational condition, so it does not add a Platform Audit finding or informational count. Authentication and password changes continue to be governed by their existing workflows and audit requirements.

## Completion checks

- Functional: hidden-by-default, independent reveal/hide, no accidental form submission, keyboard-accessible control, focus-safe, mobile tap target.
- Visual: consistent with the ElevationPilot dark login shell and red focus treatment.
- Cosmetic: password input spacing reserves room for the eye control without overlapping typed text.
- Smell test: no password logging, URL placement, account selection, session mutation, or communication side effect is introduced by visibility.
