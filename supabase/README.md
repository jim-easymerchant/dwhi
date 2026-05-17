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

- Real outbound/inbound sync — the modules log "would push N rows" and
  return zero counts.
- Realtime, push notifications, background tasks. Out of scope.

## One-time setup

1. Create a new project at https://supabase.com (free tier is fine).
2. Open **SQL editor → New query**, paste the contents of
   `sql/001_initial_sync_schema.sql`, and Run. The file is idempotent so
   you can re-run it after edits.
3. Paste the contents of `sql/002_household_invites.sql` and Run.
4. In the project settings → API, copy:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public** key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   Add both to `.env` (local dev) or to the GitHub Actions secrets that
   feed the direct APK build.
5. Configure auth for email-OTP — **see the section below; the default
   templates do not work for mobile**.
6. Restart Expo (`expo start --clear`) so the new env values are inlined.

Open **Settings → Cloud sync**. The mode should read
**Configured · Signed out**. Tap **Sign in**.

## Email OTP setup (REQUIRED for mobile auth)

The app uses `signInWithOtp` + `verifyOtp({ type: 'email' })`. The user
should receive a **numeric sign-in code** in their email and type it
into the app. Supabase projects can be configured for **6, 8, or up to
10** digits via Auth → Providers → Email → "One Time Password length".
The mobile app accepts any digit run between 4 and 12, normalizes
whitespace/hyphens out of the paste, and never truncates the token.
**Supabase's default email templates only render a magic link** —
on a mobile-only build that link redirects to `localhost:3000` (Site URL)
and is useless. You have to update the templates.

> **Recommendation:** turn **Confirm email OFF** in Auth → Providers →
> Email. With it off, every email goes through the **Magic Link**
> template and only `type: 'email'` is needed to verify. If you keep
> Confirm email ON, you must add `{{ .Token }}` to **both** templates
> below — the first email a brand-new user receives is the **Confirm
> Signup** template, not Magic Link, and that token only verifies with
> `type: 'signup'`. The app falls back from `email` → `signup`
> automatically (with a visible log line), but a misconfigured template
> still won't ever deliver a code in the first place.

### 1. Auth → Email Templates → "Magic Link"

The OTP code lives in the `{{ .Token }}` template variable. Supabase's
default body looks like:

```html
<h2>Magic Link</h2>
<p><a href="{{ .ConfirmationURL }}">Log in</a></p>
```

Replace it with something like:

```html
<h2>Your sign-in code</h2>
<p>Enter this sign-in code in the app:</p>
<p style="font-size: 32px; letter-spacing: 8px; font-family: monospace;">
  {{ .Token }}
</p>
<p>The code expires in 10 minutes. If you didn't request this, ignore
this email.</p>
```

You can keep the magic link if you want both flows; just make sure
`{{ .Token }}` is visible.

### 2. Auth → Email Templates → "Confirm signup"

If **Confirm email** is enabled (Auth → Providers → Email), brand-new
users get this template instead of the Magic Link template on their
first `signInWithOtp` call. Same fix — add `{{ .Token }}` to the body:

```html
<h2>Confirm your email</h2>
<p>Enter this sign-in code in the app:</p>
<p style="font-size: 32px; letter-spacing: 8px; font-family: monospace;">
  {{ .Token }}
</p>
```

Alternative (simpler): turn **Confirm email** off if you're okay with
first-sign-in users skipping that step. With it off, every email goes
through the Magic Link template.

### 3. Auth → URL Configuration

- **Site URL**: only used if you also keep the magic link. Set this to
  something benign like `https://example.com` — anything that isn't
  `localhost:3000`. Mobile users will never visit it.
- **Redirect URLs**: leave empty. The OTP flow doesn't use them.

### 4. Auth → Providers → Email

- **Enable email signups**: ON.
- **Confirm email**: optional. If ON, see step 2 above.
- **Secure email change**: optional; not used by this app today.

### 5. Verify

Send yourself an OTP from the app. The email should contain a numeric
sign-in code (length matches the project's "One Time Password length"
setting — typically 6 or 8). Pasting that code into the app should
sign you in. If you see only a link in the email, step 1 or 2 above
wasn't applied.

## Tables expected by the app

| Table | Purpose | RLS predicate |
|---|---|---|
| `households` | One row per shared household. | `dwhi_is_member(id)` for SELECT/UPDATE; `auth.uid() IS NOT NULL` for INSERT |
| `household_members` | Joins `auth.users` to households with a role (`owner` / `member`). | Members can read/manage rows in households they belong to; any auth user can insert their own first membership row. |
| `household_invites` | Owner-issued invite codes; redeemable by any signed-in user. | Owner-only INSERT; SELECT by code allowed for any auth user; UPDATE allowed only by the invitee accepting their own invite, or by the owner revoking. |
| `devices` | Optional per-device row tied to a household. | Scoped by `dwhi_is_member(household_id)`. |
| `location_events` | Per-household background location samples (local-only today; sync TBD). | Scoped by `dwhi_is_member(household_id)` when remote sync lands. |
| Domain tables (`items`, `inventory_events`, `receipts`, `receipt_items`, `ask_history`, `ask_feedback`) | Inventory + behaviour history. | Scoped by `dwhi_is_member(household_id)`. |

Required indexes (already created in `001_initial_sync_schema.sql` and
`002_household_invites.sql`):

- `household_members(household_id)` and `household_members(user_id)`
- `household_invites(invite_code)` (UNIQUE) and `household_invites(household_id)`
- Per-table `household_id` indexes on every domain table

## Remote household bootstrap (after sign-in)

After a successful `verifyOtp`, the app calls `ensureRemoteHousehold()`
(in `src/services/household/remoteHouseholdBootstrap.ts`). The
behaviour depends on what the user already has on the server:

1. **First-time sign-in.** No `household_members` row exists for
   `auth.uid()`. The app:
   - Generates a fresh UUID client-side.
   - INSERTs into `households` with that UUID.
   - INSERTs into `household_members` as `role='owner'` for the
     authenticated user.
   - Stamps the local `households.remote_id` and
     `household_members.remote_id` / `remote_user_id`.

2. **Returning user.** At least one `household_members` row exists.
   The app picks the user's owner-role membership (preferred) or oldest
   membership, links it to the active local household (so the user's
   local-only data carries over), and stamps the local member row.

3. **Already linked.** The active local household already carries a
   `remote_id`. The app re-fetches the remote household to confirm it
   still exists and is visible (membership intact), then no-ops.

Every transition is logged with the `[dwhi.household]` prefix. Failures
surface in the UI via the auth modal (post-OTP path) or the Manage
Household screen's "Create remote household" CTA.

## Invite expiration and roles

- Owner role: can mint invites (`households_invites_insert` RLS),
  remove non-owner members, revoke pending invites.
- Member role: can read household state, generate inventory events,
  leave (self-remove). Cannot mint invites or remove others.
- Invite expiration: optional `expires_at` column. The app validates
  client-side (`validateInvite()`) and the server's RLS update policy
  refuses accept on a revoked/expired invite as a second guard. Codes
  with no `expires_at` live until revoked.
- Single-use: `accepted_by_user_id` is set on accept, after which the
  invite is invalid for future accept attempts (both client guard and
  RLS predicate).

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
