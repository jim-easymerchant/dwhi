-- ===========================================================================
-- Do We Have It? — Household invites (Supabase migration 002)
--
-- Adds the `household_invites` table + RLS policies so an owner can mint
-- an invite code, another signed-in user can accept it, and the owner can
-- revoke it. Idempotent: re-runnable in the SQL editor.
--
-- Prereqs: 001_initial_sync_schema.sql has already been applied.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- household_invites
-- ---------------------------------------------------------------------------

create table if not exists household_invites (
  id                       uuid primary key default gen_random_uuid(),
  household_id             uuid not null references households(id) on delete cascade,
  invite_code              text not null unique,
  created_by_member_id     uuid references household_members(id),
  accepted_by_user_id      uuid references auth.users(id) on delete set null,
  accepted_at              timestamptz,
  expires_at               timestamptz,
  revoked_at               timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_household_invites_household on household_invites(household_id);
create unique index if not exists idx_household_invites_code on household_invites(invite_code);

drop trigger if exists trg_household_invites_updated_at on household_invites;
create trigger trg_household_invites_updated_at
  before update on household_invites
  for each row execute function dwhi_set_updated_at();

-- ---------------------------------------------------------------------------
-- Owner helper — returns true iff auth.uid() is the OWNER of a household.
-- Used by invite policies that must reject non-owner attempts to mint or
-- revoke codes.
-- ---------------------------------------------------------------------------

create or replace function dwhi_is_owner(target_household uuid)
returns boolean
language sql stable security definer as $$
  select exists (
    select 1
      from household_members hm
     where hm.household_id = target_household
       and hm.user_id = auth.uid()
       and hm.role = 'owner'
       and hm.deleted_at is null
  );
$$;

alter function dwhi_is_owner(uuid) owner to postgres;

-- ---------------------------------------------------------------------------
-- RLS — household_invites
-- ---------------------------------------------------------------------------

alter table household_invites enable row level security;

-- Members of the household can see invites for their household.
drop policy if exists household_invites_read on household_invites;
create policy household_invites_read on household_invites for select
  using (dwhi_is_member(household_id));

-- A signed-in user can also look up a single invite by its code, even
-- before they're a member — they need to read the row to accept it. Code
-- is unguessable (random 12+ chars in the app); this is the join-by-code
-- path.
drop policy if exists household_invites_read_by_code on household_invites;
create policy household_invites_read_by_code on household_invites for select
  using (auth.uid() is not null);

-- Only the household owner can mint a new invite.
drop policy if exists household_invites_insert on household_invites;
create policy household_invites_insert on household_invites for insert
  with check (dwhi_is_owner(household_id));

-- Acceptance (UPDATE accepted_by_user_id) — any signed-in user can flip a
-- valid, unaccepted, unrevoked, unexpired invite for themselves. Owners
-- can also UPDATE (e.g. revoke).
drop policy if exists household_invites_update on household_invites;
create policy household_invites_update on household_invites for update
  using (
    dwhi_is_owner(household_id)
    or (
      auth.uid() is not null
      and accepted_by_user_id is null
      and revoked_at is null
      and (expires_at is null or expires_at > now())
    )
  )
  with check (
    dwhi_is_owner(household_id)
    or accepted_by_user_id = auth.uid()
  );

-- Only the household owner can DELETE (hard delete) — soft delete via
-- revoked_at is preferred from the app.
drop policy if exists household_invites_delete on household_invites;
create policy household_invites_delete on household_invites for delete
  using (dwhi_is_owner(household_id));

-- ---------------------------------------------------------------------------
-- Tightened policies on household_members
-- ---------------------------------------------------------------------------
-- The 001 migration allowed members to update/delete each other. With the
-- invites flow we tighten: only the OWNER can remove non-owner members.
-- Members can still see other members.

drop policy if exists household_members_update on household_members;
create policy household_members_update on household_members for update
  using (
    dwhi_is_owner(household_id)
    or user_id = auth.uid()   -- a user can update their own row (e.g. display_name)
  )
  with check (
    dwhi_is_owner(household_id)
    or user_id = auth.uid()
  );

drop policy if exists household_members_delete on household_members;
create policy household_members_delete on household_members for delete
  using (
    -- owner can remove non-owner; self-removal is also allowed
    (dwhi_is_owner(household_id) and role <> 'owner')
    or user_id = auth.uid()
  );

-- ===========================================================================
-- Notes
-- ---------------------------------------------------------------------------
-- - Invite codes are minted client-side (12+ char random) and inserted via
--   the household_invites_insert policy. The unique index on invite_code
--   guards against rare collisions.
-- - "Owner-only mint" is enforced via dwhi_is_owner(). Non-owners attempting
--   to INSERT will be rejected by RLS, not by the app.
-- - Owner can demote themselves only by promoting another member to owner
--   first — that flow is NOT in this migration; will arrive when the app
--   needs role transfer.
-- ===========================================================================
