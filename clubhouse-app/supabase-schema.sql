-- Run this once in your Supabase project's SQL Editor (Supabase dashboard > SQL Editor > New query)

create table if not exists members (
  id bigint generated always as identity primary key,
  username text unique not null,
  passcode text not null,
  display_name text not null,
  status text not null default 'pending', -- 'pending' | 'approved' | 'owner'
  created_at timestamptz not null default now()
);

create table if not exists group_messages (
  id bigint generated always as identity primary key,
  from_username text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists dm_messages (
  id bigint generated always as identity primary key,
  pair_key text not null, -- the two usernames, sorted and joined with "__"
  from_username text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists dm_messages_pair_idx on dm_messages (pair_key);

-- Row Level Security: enabled with permissive policies so the app's anon key
-- can read/write. This app does its own username+passcode check in application
-- code rather than Supabase Auth, so there is no per-row ownership to enforce.
-- Good enough for a small private club; do not use this pattern for anything
-- handling sensitive data.

alter table members enable row level security;
alter table group_messages enable row level security;
alter table dm_messages enable row level security;

create policy "public read members" on members for select using (true);
create policy "public insert members" on members for insert with check (true);
create policy "public update members" on members for update using (true);
create policy "public delete members" on members for delete using (true);

create policy "public read group_messages" on group_messages for select using (true);
create policy "public insert group_messages" on group_messages for insert with check (true);

create policy "public read dm_messages" on dm_messages for select using (true);
create policy "public insert dm_messages" on dm_messages for insert with check (true);
