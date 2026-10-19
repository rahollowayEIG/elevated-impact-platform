# ElevationPilot: installable desktop app (PWA foundation)

**Status:** Implemented as a separate, unmerged GitHub feature branch. It has **not been deployed** to live or sandbox, and no installation has yet been verified on a real Windows or Mac desktop. This is a foundation, not a native Windows .exe or macOS .app installer.

## What this adds

- Production manifest: `/pwa/live.webmanifest`, installed name **ElevationPilot**.
- Sandbox manifest: `/pwa/sandbox.webmanifest`, installed name **ElevationPilot Sandbox**.
- Distinct stable app manifest IDs, tab titles, iOS app titles, and separate 192px/512px PNG icons. Icons use current EIG navy/red; sandbox has an unmistakable gold frame and must also retain the in-app persistent SANDBOX badge from the separate sandbox branding work.
- Standalone display window and desktop app/launcher entry in browsers supporting web app installation.
- Manifest selection occurs **at build time** from `VITE_ELEVATIONPILOT_SANDBOX`, not from a visitor-supplied URL or a fake role toggle.
- A sandbox build fails if `VITE_SUPABASE_URL` differs from `https://publruuuyvpggogrrgwp.supabase.co`. A live-branded build cannot accidentally point at that sandbox URL.
- The same application remains cloud-hosted. No registration, payment, sensitive profile, email, or Squawk content is cached offline. **This PR deliberately does not register a service worker.**
- The PNG icons are reproducibly generated using Node's built-in modules. They are **provisional visual assets** and can be replaced with final approved EIG iconography before public release.

## How to check locally

1. `npm ci`
2. `npm run test:pwa`
3. `npm run build`
4. `node scripts/verify-pwa-build.mjs live`
5. In a *separate isolated build environment*, set `VITE_ELEVATIONPILOT_SANDBOX=true`, `VITE_SUPABASE_URL=https://publruuuyvpggogrrgwp.supabase.co` and a **sandbox public** Supabase API key, then run `npm run build`.
6. `node scripts/verify-pwa-build.mjs sandbox`

The pull request's PWA GitHub Actions workflow builds and verifies **both variants**. The existing application tests also run as part of `npm run build`.

## Installation once deployed and verified

**Windows:** Open the correct production or sandbox origin in Chrome or Edge, then use the browser's **Install app** option or install icon if shown.

**Mac:** In Chrome/Edge, use **Install app**. Safari on supported macOS versions offers **File → Add to Dock**.

Both variants install as standalone app windows when supported. The production app is at its production origin, while the sandbox origin is `https://elevationpilot-sandbox.vercel.app`; they do not share an origin. Installation support and exact browser menu wording vary.

A browser may support installing from its menu even when no in-page `beforeinstallprompt` event appears. This initial implementation intentionally relies on the browser's native installation UI rather than a misleading custom button.

## Release/security checklist

- Keep this PR **unmerged** until code review; never deploy sandbox credentials or sandbox data to production.
- Verify production and sandbox Vercel build environments select the appropriate manifest, PWA title, favicon and backend.
- Merge/coordinate with sandbox navigation and branding PRs before testing a live sandbox PWA. Do not install the older unguarded sandbox deployment.
- Confirm offline mode does **not** process or queue registrations, payments, contracts, invitations, or messages.
- Test installation, logout/login, launch, upgrades, uninstallation, deep-link routing, and installed-app origin on Windows Chrome/Edge and Mac Chrome/Edge/Safari.
- Test a restored user session uses only its correctly scoped backend and role permissions.
- Keep the PWA online-only until offline data and sync have an explicit, reviewed design.
- Upgrade to a signed native Tauri client later only if the user requests deeper OS integration.

This work is independent of the Vercel deployment quota and can be built/tested in CI while the hosted environment remains unchanged.
