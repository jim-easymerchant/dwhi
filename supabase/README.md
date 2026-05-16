# Supabase cloud-sync (foundation)

This directory holds the SQL schema and notes for the cloud-sync foundation.
**Nothing here is required for the app to run** — the local SQLite path
keeps working with no Supabase project at all.

## What ships in this branch

- A SQL file you can paste into the Supabase SQL editor to provision the
  schema + RLS policies.
- App-side: an env-driven Supabase client (returns `null` when env vars
  are missing) and a Settings → **Cloud sync** card showing the current
  mode + pending-changes count.
- Stubs for `pushPending` / `pullChanges` / `syncNow` so the wiring is in
  place and the manual "Sync now" button can call into it once auth is
  added.

## What is *not* in this branch

- Real auth UI (sign in / sign up). Stub returns `false` for `isSignedIn`;
  the **Sync now** button stays disabled until that lands.
- Real outbound/inbound sync — the modules log "would push N rows" and
  return zero counts.
- Realtime, push notifications, background tasks. Out of scope.

## One-time setup

1. Create a new project at https://supabase.com (free tier is fine).
2. Open **SQL editor → New query**, paste the contents of
   `sql/001_initial_sync_schema.sql`, and Run. The file is idempotent so
   you can re-run it after edits.
3. In the project settings → API, copy:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public** key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   Add both to `.env` (local dev) or to the GitHub Actions secrets that
   feed the direct APK build.
4. Restart Expo (`expo start --clear`) so the new env values are inlined.

Open **Settings → Cloud sync**. The mode should now read
**Configured · Signed out** (because the auth UI is stubbed). The local
app continues to work; nothing is pushed or pulled until auth + real sync
land.

## RLS policy summary

Every row in every table carries `household_id`. The policy on every
domain table is the same shape:

```sql
USING (dwhi_is_member(household_id))
WITH CHECK (dwhi_is_member(household_id))
```

`dwhi_is_member(uuid)` is a SECURITY DEFINER helper that returns `true`
iff `auth.uid()` is the `user_id` of a row in `household_members` for the
target household.

- A signed-in user can only see / write rows in households they're a
  member of.
- The **anon key** in the APK bundle is therefore safe to leak: without
  a signed-in session, every SELECT returns zero rows.
- Inserts on `households` are gated by `auth.uid() is not null` so any
  signed-in user can create a household and immediately self-join via
  `household_members`.

## Key safety

- `EXPO_PUBLIC_SUPABASE_ANON_KEY` is inlined into the JS bundle. That's
  okay — anon keys are explicitly designed for client use under RLS.
- Never put the service-role key in the app. It is not used anywhere in
  this branch.
