-- ===========================================================================
-- Do We Have It? — Phase 1 sync schema: items + inventory_events
--
-- Adds the two remote tables the mobile sync layer talks to. Both are
-- household-scoped via `household_id` and protected by the same RLS
-- predicate as the rest of the project: dwhi_is_member(household_id).
--
-- Idempotency model
-- -----------------
-- The first ship of this file relied on plain `create table if not
-- exists` followed by `create index if not exists`. That blew up when
-- a previous run (or hand-rolled partial install) had created the
-- table without one of the newer columns — the CREATE TABLE clause
-- becomes a no-op and the later CREATE INDEX references a column
-- Postgres doesn't have yet (ERROR 42703).
--
-- This revision is shaped so re-running on ANY of the following
-- starting states converges to the right schema:
--   1. Brand-new project (no items / inventory_events tables yet).
--   2. Both tables exist with the full Phase 1 column set.
--   3. Both tables exist but are missing one or more columns
--      (e.g. local_id, local_item_id, normalized_name, …).
--   4. Partial install where indexes / policies were already created
--      against an older shape.
--
-- The pattern per table is:
--   a. `create table if not exists` with a minimal-but-complete column
--      list, so brand-new projects get the full shape in one step.
--   b. An explicit `alter table … add column if not exists` for EVERY
--      expected column. This is the bit that rescues case (3).
--   c. THEN — and only then — indexes / triggers / policies that
--      reference those columns.
--
-- If you've hit "column does not exist" while running this file, see
-- the one-time repair block at the very bottom for a hint.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1a. items — base table (idempotent create)
-- ---------------------------------------------------------------------------

create table if not exists public.items (
  id                       uuid primary key default gen_random_uuid(),
  household_id             uuid not null references public.households(id) on delete cascade,
  local_id                 text,
  name                     text not null,
  normalized_name          text,
  category                 text,
  barcode                  text,
  photo_uri                text,
  notes                    text,
  quantity                 numeric,
  unit                     text,
  confidence               numeric,
  created_by_member_id     uuid references public.household_members(id),
  created_by_device_id     text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz
);

-- ---------------------------------------------------------------------------
-- 1b. items — additive column upgrades.
--
-- Every column declared above is repeated here as ADD COLUMN IF NOT
-- EXISTS so a re-run on a pre-existing partial table fills in any
-- gaps. The ordering of these statements doesn't matter, but they
-- MUST all run before the index / trigger / policy section below —
-- otherwise the indexes will reference columns the table doesn't
-- have yet.
-- ---------------------------------------------------------------------------

alter table public.items add column if not exists household_id           uuid;
alter table public.items add column if not exists local_id               text;
alter table public.items add column if not exists name                   text;
alter table public.items add column if not exists normalized_name        text;
alter table public.items add column if not exists category               text;
alter table public.items add column if not exists barcode                text;
alter table public.items add column if not exists photo_uri              text;
alter table public.items add column if not exists notes                  text;
alter table public.items add column if not exists quantity               numeric;
alter table public.items add column if not exists unit                   text;
alter table public.items add column if not exists confidence             numeric;
alter table public.items add column if not exists created_by_member_id   uuid;
alter table public.items add column if not exists created_by_device_id   text;
alter table public.items add column if not exists created_at             timestamptz not null default now();
alter table public.items add column if not exists updated_at             timestamptz not null default now();
alter table public.items add column if not exists deleted_at             timestamptz;

-- ---------------------------------------------------------------------------
-- 1c. items — indexes (safe now that every referenced column exists)
-- ---------------------------------------------------------------------------

create index if not exists idx_items_household_id   on public.items(household_id);
create index if not exists idx_items_updated_at     on public.items(updated_at);
create index if not exists idx_items_deleted_at     on public.items(deleted_at);
create index if not exists idx_items_local_id       on public.items(local_id);
create index if not exists idx_items_barcode        on public.items(barcode);

-- ---------------------------------------------------------------------------
-- 1d. items — updated_at trigger
-- ---------------------------------------------------------------------------

drop trigger if exists trg_items_updated_at on public.items;
create trigger trg_items_updated_at
  before update on public.items
  for each row execute function dwhi_set_updated_at();

-- ===========================================================================
-- 2a. inventory_events — base table
-- ===========================================================================

create table if not exists public.inventory_events (
  id                       uuid primary key default gen_random_uuid(),
  household_id             uuid not null references public.households(id) on delete cascade,
  item_id                  uuid references public.items(id),
  local_id                 text,
  local_item_id            text,
  event_type               text not null,
  quantity_delta           numeric,
  quantity_after           numeric,
  source                   text,
  note                     text,
  occurred_at              timestamptz not null,
  created_by_member_id     uuid references public.household_members(id),
  created_by_device_id     text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz
);

-- ---------------------------------------------------------------------------
-- 2b. inventory_events — additive column upgrades.
--
-- Same rationale as items: a previous partial install may have
-- created this table without one of these columns. Running these
-- BEFORE the indexes makes the file safe to re-run.
-- ---------------------------------------------------------------------------

alter table public.inventory_events add column if not exists household_id           uuid;
alter table public.inventory_events add column if not exists item_id                uuid;
alter table public.inventory_events add column if not exists local_id               text;
alter table public.inventory_events add column if not exists local_item_id          text;
alter table public.inventory_events add column if not exists event_type             text;
alter table public.inventory_events add column if not exists quantity_delta         numeric;
alter table public.inventory_events add column if not exists quantity_after         numeric;
alter table public.inventory_events add column if not exists source                 text;
alter table public.inventory_events add column if not exists note                   text;
alter table public.inventory_events add column if not exists occurred_at            timestamptz;
alter table public.inventory_events add column if not exists created_by_member_id   uuid;
alter table public.inventory_events add column if not exists created_by_device_id   text;
alter table public.inventory_events add column if not exists created_at             timestamptz not null default now();
alter table public.inventory_events add column if not exists updated_at             timestamptz not null default now();
alter table public.inventory_events add column if not exists deleted_at             timestamptz;

-- ---------------------------------------------------------------------------
-- 2c. inventory_events — indexes (safe now)
-- ---------------------------------------------------------------------------

create index if not exists idx_inventory_events_household_id   on public.inventory_events(household_id);
create index if not exists idx_inventory_events_updated_at     on public.inventory_events(updated_at);
create index if not exists idx_inventory_events_deleted_at     on public.inventory_events(deleted_at);
create index if not exists idx_inventory_events_local_id       on public.inventory_events(local_id);
create index if not exists idx_inventory_events_item_id        on public.inventory_events(item_id);
create index if not exists idx_inventory_events_occurred_at    on public.inventory_events(occurred_at);

-- ---------------------------------------------------------------------------
-- 2d. inventory_events — updated_at trigger
-- ---------------------------------------------------------------------------

drop trigger if exists trg_inventory_events_updated_at on public.inventory_events;
create trigger trg_inventory_events_updated_at
  before update on public.inventory_events
  for each row execute function dwhi_set_updated_at();

-- ===========================================================================
-- 3. RLS
--
-- Same shape as the rest of the project: every operation is gated on
-- `dwhi_is_member(household_id)`. DELETE is intentionally NOT a policy
-- — the app does soft delete via `deleted_at`. Postgres still allows
-- DELETE for a service-role key out-of-band, but client SDK calls have
-- no SELECT-on-DELETE policy and thus can't remove rows.
-- ===========================================================================

alter table public.items            enable row level security;
alter table public.inventory_events enable row level security;

drop policy if exists items_read on public.items;
create policy items_read on public.items for select
  using (dwhi_is_member(household_id));

drop policy if exists items_insert on public.items;
create policy items_insert on public.items for insert
  with check (dwhi_is_member(household_id));

drop policy if exists items_update on public.items;
create policy items_update on public.items for update
  using (dwhi_is_member(household_id))
  with check (dwhi_is_member(household_id));

drop policy if exists inventory_events_read on public.inventory_events;
create policy inventory_events_read on public.inventory_events for select
  using (dwhi_is_member(household_id));

drop policy if exists inventory_events_insert on public.inventory_events;
create policy inventory_events_insert on public.inventory_events for insert
  with check (dwhi_is_member(household_id));

drop policy if exists inventory_events_update on public.inventory_events;
create policy inventory_events_update on public.inventory_events for update
  using (dwhi_is_member(household_id))
  with check (dwhi_is_member(household_id));

-- ===========================================================================
-- Notes
-- ---------------------------------------------------------------------------
-- - `local_id` / `local_item_id` are TEXT so any client-side primary
--   key shape works (today: SQLite INTEGER → stringified). They are NOT
--   unique — two different devices may create rows whose stringified
--   local ids happen to collide. The (household_id, id) UUID is the
--   real primary key.
-- - `deleted_at` is a soft-delete tombstone; readers should filter it
--   out unless they specifically want to see deletions.
-- - `note` exists for forward compatibility (e.g. "added 2 cans" notes
--   the user might type). The Phase 1 sync writer leaves it null.
-- - Foreign keys ON DELETE CASCADE: if the entire household goes away
--   (operator-side cleanup), its items + events go with it. The app
--   never CASCADE-deletes a household client-side.
--
-- ONE-TIME REPAIR (if a previous run left tables in a half-built state)
-- ---------------------------------------------------------------------------
-- Symptom: re-running this file errors with
--   ERROR: 42703: column "local_id" does not exist
-- Cause: the table existed before this revision and is missing one of
-- the columns the indexes reference.
--
-- Fix (paste into the SQL editor and Run once, THEN re-run this file):
--
--   alter table public.items
--     add column if not exists local_id               text,
--     add column if not exists normalized_name        text,
--     add column if not exists photo_uri              text,
--     add column if not exists notes                  text,
--     add column if not exists quantity               numeric,
--     add column if not exists unit                   text,
--     add column if not exists confidence             numeric,
--     add column if not exists created_by_member_id   uuid,
--     add column if not exists created_by_device_id   text,
--     add column if not exists deleted_at             timestamptz;
--
--   alter table public.inventory_events
--     add column if not exists local_id               text,
--     add column if not exists local_item_id          text,
--     add column if not exists quantity_delta         numeric,
--     add column if not exists quantity_after         numeric,
--     add column if not exists note                   text,
--     add column if not exists created_by_member_id   uuid,
--     add column if not exists created_by_device_id   text,
--     add column if not exists deleted_at             timestamptz;
--
-- The same statements live in section 1b / 2b above, so the next time
-- you run this whole file end-to-end the repair is implicit.
-- ===========================================================================
