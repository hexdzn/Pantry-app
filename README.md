# Pantry

A family kitchen app — one shared list for groceries and sabzi/fruits, with
Gmail sign-in, a family share code, "Due this week" restock, WhatsApp send to
your vendor, and each item tagged with the initials of whoever added it.

Stack: Next.js 14 (App Router) · Supabase (auth + Postgres + realtime) · PWA.

## Quick start
```bash
cp .env.local.example .env.local   # add your Supabase URL + anon key
npm install
npm run dev
```
Full deploy steps (Supabase schema, Google OAuth, Vercel): see **SETUP.md**.

## Layout
- `components/PantryApp.tsx` — the whole UI + catalog + Supabase data layer
- `lib/supabaseClient.ts` — browser Supabase client (PKCE OAuth)
- `supabase/schema.sql` — run once in the Supabase SQL editor
- `public/` — PWA manifest, service worker, icons
