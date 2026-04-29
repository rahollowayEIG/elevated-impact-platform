# Elevated Impact Platform

Phase 1 internal MVP for Elevated Impact Group.

## What this includes

- Event builder
- Event dashboard
- Sponsorship tracking structure
- Event needs / requests
- Volunteer tracking
- Media / advertising page
- Supabase connection layer
- Mock/demo fallback if Supabase env vars are not set

## Local setup

```bash
npm install
npm run dev
```

## Environment variables

Create `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

## Vercel build settings

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
