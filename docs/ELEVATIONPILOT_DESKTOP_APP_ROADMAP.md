# ElevationPilot Desktop App Roadmap

Status: **Approved direction for future work. Not yet implemented.**
This note captures the agreed design so that the option is not lost as the Sandbox, Airport, and Event Builder are completed.

## Decision

ElevationPilot can be a desktop application **because it is cloud-based**, not in spite of it. Reuse the current React/Vite application, Vercel hosting and existing Supabase-backed modules. Do not fork business rules or duplicate the Event Builder, Registration, Payments, Airport, Squawk Box, or other extensions into an unrelated product.

**Stage 1: Installable PWA (preferred first release)**
- Support modern desktop browsers on **Windows and macOS**.
- Provide an app icon, install prompt when the browser supports it, a standalone desktop window, correct app name in the OS, and online updates without requiring users to download a new installer for each change.
- Build **two clearly separate installed app identities**, not a hidden environment switch:
  - **ElevationPilot** for live production.
  - **ElevationPilot Sandbox** for training, fictional demo registrations, and QA.
- Give them distinct manifest `name`, `short_name`, icons, `start_url`/`scope`, and branding. Sandbox icon gets an unmistakable amber border/accent; live uses EIG navy/brand identity.
- The Sandbox window, browser title, home/header area, and **every page** must display persistent **SANDBOX / Practice environment** labeling. The production app must never display this marker.
- Keep hosting, Supabase URLs, Auth identities, login redirects, credentials, cookies, browser storage, service-worker caches, push endpoints and links isolated by **distinct origins**. The sandbox can never route real customers to the live registration or payment flow.
- Prefer normal online behavior in the MVP. Do **not** queue or replay offline mutations for payments, registrations, refunds, invitations, Squawk messages, or contract signatures. Add read-only offline features only after explicit security and sync tests.
- Honor platform role routing: EIG Command Center, Pilot/Co-Pilot Cockpit, ATC Center, Passenger Airport. Keep the same event-scoped permissions and RLS enforcement.
- Ensure desktop-size Event Builder and creative tools work well with drag/drop and file picking (within the browser's supported APIs), while remaining functional in the ordinary web interface.

**Stage 2: Optional richer native desktop app**
- Evaluate **Tauri** only after the PWA and sandbox safety gates pass.
- Keep web-based cloud APIs and shared modules as the systems of record.
- Potential advantages: deeper local file handling, native menus, packaging/updaters, dedicated hardware integrations, and tightly scoped approved OS capabilities.
- Review threat model, signed builds, update channels, secrets management, and sandbox-versus-production package separation before shipping.
- Do not promise offline edit or deep system integration until tested for the specific operating systems.

## Shipping gates for the Stage 1 PWA

1. Deploy and verify sandbox navigation/Supabase target guards and unmistakable sandbox branding (draft PRs #60 and #63).
2. Complete restricted fictional Auth account provisioning, RLS/RPC testing, mail/SMS/Stripe/Google isolation, and Airport/Registration/Event Builder end-to-end tests. Production remains untouched.
3. Add versioned web app manifests and appropriate independently-created EIG app icons. Never use the same manifest identity or shared cache namespace between live and sandbox.
4. Add an intentionally small, auditable service worker only if needed for reliable installability, with **no caching of customer private data, Auth API responses, or sensitive API requests**.
5. Test installation, restart, new-version upgrade, uninstallation, sign-in/sign-out, Vercel deployment protection, window titles, home screen and persistent environment badges on Windows and macOS.
6. Evaluate launch and future native packaging after the above acceptance tests pass.

This is a **future feature roadmap**, not an indication the installable PWA or Tauri application has already been built or deployed.
