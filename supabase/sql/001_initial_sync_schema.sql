-- ===========================================================================
-- Do We Have It? — initial cloud-sync schema (Supabase)
--
-- Run order:
--   1. Open the Supabase SQL editor for your project.
--   2. Paste the whole file in a single tab and Run.
--   3. (Optional) seed a household + member for your auth user via the
--      Supabase auth dashboard, then INSERT a household_members row with
--      your auth.uid().
--
-- Idempotency:
--   * Every CREATE TABLE uses IF NOT EXISTS.
--   * Every policy is dropped and recreated.
--   * Re-run is safe; existing data is preserved.
--
-- This file mirrors the local SQLite schema in src/db/schema.ts but with:
--   * UUID PKs (for cross-device uniqueness without an autoincrement collision)
--   * household_id as UUID FK
--   * created_by_member_id, created_by_device_id as UUID
--   * created_at + updated_at TIMESTAMPTZ with defaults + triggers
--   * deleted_at TIMESTAMPTZ for soft-delete propagation
--   * RLS policies that only let auth.uid() see rows in households they're
--     a member of.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- Generic "bump updated_at on UPDATE" trigger function.
create or replace function dwhi_set_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- households
-- ---------------------------------------------------------------------------

create table if not exists households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

drop trigger if exists trg_households_updated_at on households;
create trigger trg_households_updated_at
  before update on households
  for each row execute function dwhi_set_updated_at();

-- ---------------------------------------------------------------------------
-- household_members  (joins auth.users to households)
-- ---------------------------------------------------------------------------

create table if not exists household_members (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade, -- nullable for pre-linked members
  display_name    text not null,
  role            text not null check (role in ('owner', 'member')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  unique (household_id, user_id)
);

create index if not exists idx_household_members_household on household_members(household_id);
create index if not exists idx_household_members_user      on household_members(user_id);

drop trigger if exists trg_household_members_updated_at on household_members;
create trigger trg_household_members_updated_at
  before update on household_members
  for each row execute function dwhi_set_updated_at();

-- ---------------------------------------------------------------------------
-- devices
-- ---------------------------------------------------------------------------

create table if not exists devices (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  device_name   text not null,
  device_uuid   text not null unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists idx_devices_household on devices(household_id);

drop trigger if exists trg_devices_updated_at on devices;
create trigger trg_devices_updated_at
  before update on devices
  for each row execute function dwhi_set_updated_at();

-- ---------------------------------------------------------------------------
-- items
-- ---------------------------------------------------------------------------

create table if not exists items (
  id                      uuid primary key default gen_random_uuid(),
  household_id            uuid not null references households(id) on delete cascade,
  manufacturer            text,
  name                    text not null,
  category                text,
  container_type          text,
  size                    text,
  canonical_key           text,
  barcode                 text,
  source                  text,
  raw_lookup_json         jsonb,
  created_by_member_id    uuid references household_members(id),
  created_by_device_id    uuid references devices(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz
);

create index if not exists idx_items_household       on items(household_id);
create index if not exists idx_items_canonical_key   on items(canonical_key);
create index if not exists idx_items_barcode         on items(barcode);
create index if not exists idx_items_updated_at      on items(updated_at);

drop trigger if exists trg_items_updated_at on items;
create trigger trg_items_updated_at
  before update on items
  for each row execute function dwhi_set_updated_at();

-- ---------------------------------------------------------------------------
-- inventory_events
-- ---------------------------------------------------------------------------

create table if not exists inventory_events (
  id                      uuid primary key default gen_random_uuid(),
  household_id            uuid not null references households(id) on delete cascade,
  item_id                 uuid not null references items(id) on delete cascade,
  direction               text not null check (direction in ('IN', 'OUT')),
  quantity                integer not null default 1,
  image_uri               text,
  raw_ai_json             jsonb,
  source                  text not null,
  created_by_member_id    uuid references household_members(id),
  created_by_device_id    uuid references devices(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz
);

create index if not exists idx_inventory_events_household   on inventory_events(household_id);
create index if not exists idx_inventory_events_item        on inventory_events(item_id);
create index if not exists idx_inventory_events_created_at  on inventory_events(created_at);
create index if not exists idx_inventory_events_updated_at  on inventory_events(updated_at);

drop trigger if exists trg_inventory_events_updated_at on inventory_events;
create trigger trg_inventory_events_updated_at
  before update on inventory_events
  for each row execute function dwhi_set_updated_at();

-- ---------------------------------------------------------------------------
-- receipts
-- ---------------------------------------------------------------------------

create table if not exists receipts (
  id                      uuid primary key default gen_random_uuid(),
  household_id            uuid not null references households(id) on delete cascade,
  store_name              text,
  purchased_at            timestamptz,
  total                   numeric,
  image_uri               text,
  raw_ai_json             jsonb,
  parse_source            text,
  created_by_member_id    uuid references household_members(id),
  created_by_device_id    uuid references devices(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz
);

create index if not exists idx_receipts_household   on receipts(household_id);
create index if not exists idx_receipts_updated_at  on receipts(updated_at);

drop trigger if exists trg_receipts_updated_at on receipts;
create trigger trg_receipts_updated_at
  before update on receipts
  for each row execute function dwhi_set_updated_at();

-- ---------------------------------------------------------------------------
-- receipt_items
-- ---------------------------------------------------------------------------

create table if not exists receipt_items (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references households(id) on delete cascade,
  receipt_id          uuid not null references receipts(id) on delete cascade,
  canonical_name      text,
  raw_name            text,
  quantity            integer,
  estimated_category  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create index if not exists idx_receipt_items_household  on receipt_items(household_id);
create index if not exists idx_receipt_items_receipt    on receipt_items(receipt_id);

drop trigger if exists trg_receipt_items_updated_at on receipt_items;
create trigger trg_receipt_items_updated_at
  before update on receipt_items
  for each row execute function dwhi_set_updated_at();

-- ---------------------------------------------------------------------------
-- ask_history
-- ---------------------------------------------------------------------------

create table if not exists ask_history (
  id                      uuid primary key default gen_random_uuid(),
  household_id            uuid not null references households(id) on delete cascade,
  query_text              text not null,
  normalized_term         text not null,
  created_by_member_id    uuid references household_members(id),
  created_by_device_id    uuid references devices(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz
);

create index if not exists idx_ask_history_household        on ask_history(household_id);
create index if not exists idx_ask_history_normalized_term  on ask_history(normalized_term);
create index if not exists idx_ask_history_created_at       on ask_history(created_at);

drop trigger if exists trg_ask_history_updated_at on ask_history;
create trigger trg_ask_history_updated_at
  before update on ask_history
  for each row execute function dwhi_set_updated_at();

-- ---------------------------------------------------------------------------
-- ask_feedback
-- ---------------------------------------------------------------------------

create table if not exists ask_feedback (
  id                      uuid primary key default gen_random_uuid(),
  household_id            uuid not null references households(id) on delete cascade,
  normalized_term         text not null,
  answer_level            text not null,
  user_feedback           text not null check (user_feedback in ('have', 'dont', 'unsure')),
  created_by_member_id    uuid references household_members(id),
  created_by_device_id    uuid references devices(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz
);

create index if not exists idx_ask_feedback_household        on ask_feedback(household_id);
create index if not exists idx_ask_feedback_normalized_term  on ask_feedback(normalized_term);

drop trigger if exists trg_ask_feedback_updated_at on ask_feedback;
create trigger trg_ask_feedback_updated_at
  before update on ask_feedback
  for each row execute function dwhi_set_updated_at();

-- ===========================================================================
-- Row-Level Security
--
-- Every row in every domain table belongs to exactly one household. The
-- policies say: "you can SELECT / INSERT / UPDATE / DELETE rows in
-- household H if and only if you (auth.uid()) are a row in
-- household_members for household H."
--
-- A helper function keeps the predicate short and the EXPLAIN plans
-- readable.
-- ===========================================================================

create or replace function dwhi_is_member(target_household uuid)
returns boolean
language sql stable security definer as $$
  select exists (
    select 1
      from household_members hm
     where hm.household_id = target_household
       and hm.user_id = auth.uid()
       and hm.deleted_at is null
  );
$$;

alter function dwhi_is_member(uuid) owner to postgres;

-- Helper to emit four policies (read/insert/update/delete) on a table whose
-- rows carry a `household_id` column.
do $$
declare
  t text;
  tables text[] := array[
    'households', 'household_members', 'devices',
    'items', 'inventory_events', 'receipts', 'receipt_items',
    'ask_history', 'ask_feedback'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end$$;

-- households: a member can read/update only the household they belong to.
-- Creating a new household is allowed for any authenticated user (they
-- become its first owner via household_members insert next).
drop policy if exists households_read on households;
create policy households_read on households for select
  using (dwhi_is_member(id));
drop policy if exists households_write on households;
create policy households_write on households for update
  using (dwhi_is_member(id))
  with check (dwhi_is_member(id));
drop policy if exists households_insert on households;
create policy households_insert on households for insert
  with check (auth.uid() is not null);

-- household_members: a member can see + manage members of households they
-- belong to. Anyone can insert their own first membership row (used when
-- creating a household and immediately self-joining).
drop policy if exists household_members_read on household_members;
create policy household_members_read on household_members for select
  using (dwhi_is_member(household_id) or user_id = auth.uid());
drop policy if exists household_members_insert on household_members;
create policy household_members_insert on household_members for insert
  with check (
    auth.uid() is not null
    and (
      dwhi_is_member(household_id)
      or user_id = auth.uid()
    )
  );
drop policy if exists household_members_update on household_members;
create policy household_members_update on household_members for update
  using (dwhi_is_member(household_id))
  with check (dwhi_is_member(household_id));
drop policy if exists household_members_delete on household_members;
create policy household_members_delete on household_members for delete
  using (dwhi_is_member(household_id));

-- devices: same shape as the generic domain tables — scope by household.
do $$
declare t text; tables text[] := array[
  'devices', 'items', 'inventory_events', 'receipts',
  'receipt_items', 'ask_history', 'ask_feedback'
];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I_read on %I;', t, t);
    execute format(
      'create policy %I_read on %I for select using (dwhi_is_member(household_id));',
      t, t
    );
    execute format('drop policy if exists %I_insert on %I;', t, t);
    execute format(
      'create policy %I_insert on %I for insert with check (dwhi_is_member(household_id));',
      t, t
    );
    execute format('drop policy if exists %I_update on %I;', t, t);
    execute format(
      'create policy %I_update on %I for update using (dwhi_is_member(household_id)) with check (dwhi_is_member(household_id));',
      t, t
    );
    execute format('drop policy if exists %I_delete on %I;', t, t);
    execute format(
      'create policy %I_delete on %I for delete using (dwhi_is_member(household_id));',
      t, t
    );
  end loop;
end$$;

-- ===========================================================================
-- Notes
-- ---------------------------------------------------------------------------
-- - No service-role key is ever used in the app. The app authenticates as
--   a user with auth.uid(); RLS does the rest.
-- - Soft delete (`deleted_at`) is preferred over hard DELETE so a device
--   that's been offline doesn't see rows vanish unexpectedly during sync.
-- - The local SQLite schema mirrors the column names; the local
--   `remote_id` column carries the Supabase UUID once a row syncs.
-- ===========================================================================
