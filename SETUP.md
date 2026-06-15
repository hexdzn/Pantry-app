# Pantry — go live (Next.js + Supabase)

Real family sync: Gmail sign-in, a shared family code, one live list, and each
item tagged with the initials of whoever added it.

## 0. Prerequisites
- Node 18+ and npm
- A Supabase account (free tier is fine)
- A Vercel account (free tier is fine)
- A Google Cloud account (for the OAuth client)

## 1. Supabase project
1. Create a new project at supabase.com. Note the **Project URL** and **anon key**
   (Project Settings → API).
2. SQL Editor → New query → paste **`supabase/schema.sql`** → Run. This creates
   `profiles`, `households`, `household_members`, `pantry_items`, the
   create/join RPCs, row-level security, and turns on realtime.

## 2. Google sign-in
1. Google Cloud Console → APIs & Services → Credentials → Create **OAuth client ID**
   (type: Web application).
2. Authorized redirect URI — add your Supabase callback:
   `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
3. Copy the client ID + secret.
4. In Supabase → Authentication → Providers → **Google** → paste client ID + secret → enable.
5. Authentication → URL Configuration → set **Site URL** to your app URL
   (e.g. `http://localhost:3000` for dev, your Vercel URL for prod) and add both
   to **Redirect URLs**.

## 3. Run locally
```bash
cp .env.local.example .env.local      # then paste your URL + anon key
npm install
npm run dev                           # http://localhost:3000
```
Sign in with Google → set your name/initials/colour → Create a family (get the
code) or Join with a code → you're on the shared list.

## 4. Deploy to Vercel
1. Push this folder to a GitHub repo.
2. Vercel → New Project → import the repo.
3. Add env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy. Then add the Vercel URL to Supabase → Auth → URL Configuration
   (Site URL + Redirect URLs), and to the Google OAuth client's authorized origins.
5. On each family member's iPhone: open the URL in Safari → Share → **Add to Home Screen**.

## How sync works
- The catalog (item names, units, default cadence) lives in the app
  (`components/PantryApp.tsx`). Supabase only stores **selections + prefs**, so
  everyone sees the same live list.
- One row per item per household, keyed `(household_id, item_id)`. Deselecting
  keeps the row (`selected = false`) so favourites, cadence, last qty/unit, and
  the "Due" timer survive. Last-write-wins on concurrent edits (fine for a family).
- `added_by_initials` / `added_by_ci` are stored on the row, so realtime updates
  carry the adder's initials with no extra lookup — that's what the cart avatars use.

## Notes
- WhatsApp vendor numbers are stored per-device (localStorage), not shared.
- Security: keep Next.js patched (`npm i next@latest` within the 14.x line — see
  the advisory linked on install).
