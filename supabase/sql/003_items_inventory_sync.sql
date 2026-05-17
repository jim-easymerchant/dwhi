-- ===========================================================================
-- Do We Have It? — Phase 1 sync schema: items + inventory_events
--
-- Adds the two remote tables the mobile sync layer talks to. Both are
-- household-scoped via `household_id` and protected by the same RLS
-- predicate as the rest of the project: dwhi_is_member(household_id).
--
-- Idempotent: every CREATE / ALTER / POLICY is guarded so the file is
-- safe to re-run from the Supabase SQL editor.
--
-- Prereqs:
--   001_initial_sync_schema.sql (households, household_members, devices,
--                                dwhi_is_member function)
--   002_household_invites.sql   (independent of this file; safe to apply
--                                in either order)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- items
--
-- Pantry item catalogue, scoped per household. `local_id` is the
-- INTEGER PRIMARY KEY of the originating local SQLite row, stringified.
-- The mobile app uses it to attach a remote row back to the matching
-- local one on inbound pull when the local row was created before the
-- household was linked to Supabase.
-- ---------------------------------------------------------------------------

create table if not exists items (
  id                       uuid primary key default gen_random_uuid(),
  household_id             uuid not null references households(id) on delete cascade,
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
  created_by_member_id     uuid references household_members(id),
  created_by_device_id     text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz
);

create index if not exists idx_items_household_id   on items(household_id);
create index if not exists idx_items_updated_at     on items(updated_at);
create index if not exists idx_items_deleted_at     on items(deleted_at);
create index if not exists idx_items_local_id       on items(local_id);
create index if not exists idx_items_barcode        on items(barcode);

drop trigger if exists trg_items_updated_at on items;
create trigger trg_items_updated_at
  before update on items
  for each row execute function dwhi_set_updated_at();

-- ---------------------------------------------------------------------------
-- inventory_events
--
-- Append-mostly log of pantry deltas (add / consume) against an item.
-- `event_type` mirrors the local `direction` column ('IN' / 'OUT'),
-- but accepts any short text so future event kinds can land without
-- a schema change. `quantity_delta` is signed:
--   IN  → positive
--   OUT → negative
-- `local_item_id` carries the INTEGER local item id stringified, so an
-- event arriving on a fresh device can attach to a pre-existing local
-- item row when the items table syncs first.
-- ---------------------------------------------------------------------------

create table if not exists inventory_events (
  id                       uuid primary key default gen_random_uuid(),
  household_id             uuid not null references households(id) on delete cascade,
  item_id                  uuid references items(id),
  local_id                 text,
  local_item_id            text,
  event_type               text not null,
  quantity_delta           numeric,
  quantity_after           numeric,
  source                   text,
  note                     text,
  occurred_at              timestamptz not null,
  created_by_member_id     uuid references household_members(id),
  created_by_device_id     text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz
);

create index if not exists idx_inventory_events_household_id   on inventory_events(household_id);
create index if not exists idx_inventory_events_updated_at     on inventory_events(updated_at);
create index if not exists idx_inventory_events_deleted_at     on inventory_events(deleted_at);
create index if not exists idx_inventory_events_local_id       on inventory_events(local_id);
create index if not exists idx_inventory_events_item_id        on inventory_events(item_id);
create index if not exists idx_inventory_events_occurred_at    on inventory_events(occurred_at);

drop trigger if exists trg_inventory_events_updated_at on inventory_events;
create trigger trg_inventory_events_updated_at
  before update on inventory_events
  for each row execute function dwhi_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
--
-- Same shape as the rest of the project: every operation is gated on
-- `dwhi_is_member(household_id)`. DELETE is intentionally NOT a policy
-- — the app does soft delete via `deleted_at`. Postgres still allows
-- DELETE for a service-role key out-of-band, but client SDK calls have
-- no SELECT-on-DELETE policy and thus can't remove rows.
-- ---------------------------------------------------------------------------

alter table items enable row level security;
alter table inventory_events enable row level security;

drop policy if exists items_read on items;
create policy items_read on items for select
  using (dwhi_is_member(household_id));

drop policy if exists items_insert on items;
create policy items_insert on items for insert
  with check (dwhi_is_member(household_id));

drop policy if exists items_update on items;
create policy items_update on items for update
  using (dwhi_is_member(household_id))
  with check (dwhi_is_member(household_id));

drop policy if exists inventory_events_read on inventory_events;
create policy inventory_events_read on inventory_events for select
  using (dwhi_is_member(household_id));

drop policy if exists inventory_events_insert on inventory_events;
create policy inventory_events_insert on inventory_events for insert
  with check (dwhi_is_member(household_id));

drop policy if exists inventory_events_update on inventory_events;
create policy inventory_events_update on inventory_events for update
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
-- ===========================================================================
