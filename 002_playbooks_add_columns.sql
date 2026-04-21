-- Migration 002: add optional convenience columns to playbooks
-- These columns are NOT required for the app to function —
-- all data is already stored in the data JSONB column.
-- Run in Supabase SQL editor if you want server-side filtering by advisor, year, or flags.

alter table playbooks
  add column if not exists advisor_id text default 'advisor-default',
  add column if not exists irpf_years integer[],
  add column if not exists review_flags jsonb,
  add column if not exists updated_at timestamp with time zone default now();

-- Auto-update updated_at on every row change
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists playbooks_updated_at on playbooks;
create trigger playbooks_updated_at
  before update on playbooks
  for each row execute function update_updated_at_column();
