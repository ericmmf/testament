-- Testament MVP — Initial Schema
-- Run this in the Supabase SQL Editor (single execution)
-- Migration: 001_initial_schema

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";


-- ============================================================
-- CLIENTS
-- ============================================================
create table public.clients (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Identity
  full_name     text not null,
  cpf           text not null unique,
  email         text,
  phone         text,

  -- Status mirrors PlaybookData.status lifecycle
  status        text not null default 'ingesting'
                check (status in ('ingesting', 'draft', 'in_review', 'approved', 'delivered')),

  -- Free-form advisor notes at the client level
  advisor_notes text
);


-- ============================================================
-- IRPF UPLOADS
-- ============================================================
create table public.irpf_uploads (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz not null default now(),

  client_id     uuid not null references public.clients(id) on delete cascade,

  -- The calendar year this IRPF declaration covers (e.g. 2024)
  irpf_year     smallint not null,

  -- 'dec' = .DEC file (deterministic), 'pdf' = PDF (Claude extraction)
  file_type     text not null check (file_type in ('dec', 'pdf')),

  -- Path in Supabase Storage: {client_id}/{upload_id}/{filename}
  storage_path  text not null,
  original_filename text not null,

  -- Parsed output — full IRPFData JSON
  parsed_data   jsonb,

  -- null = not yet parsed, 'ok' = success, 'error' = parse failed
  parse_status  text check (parse_status in ('ok', 'error', 'pending')),
  parse_error   text
);

-- One upload per client per year per file type
create unique index irpf_uploads_client_year_type
  on public.irpf_uploads(client_id, irpf_year, file_type);


-- ============================================================
-- PLAYBOOKS
-- ============================================================
create table public.playbooks (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  client_id     uuid not null references public.clients(id) on delete cascade,

  -- One active playbook per client
  -- Full PlaybookData JSON — advisor edits land here
  playbook_data jsonb,

  -- Mirrors clients.status but at the playbook level
  status        text not null default 'draft'
                check (status in ('draft', 'in_review', 'approved', 'delivered')),

  -- IRPF years included in this playbook draft (e.g. [2023, 2024])
  irpf_years_loaded smallint[] not null default '{}',

  -- Path to the generated client PDF in Storage (set after approval)
  output_pdf_path text
);

-- One playbook per client
create unique index playbooks_client_id
  on public.playbooks(client_id);


-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create trigger playbooks_updated_at
  before update on public.playbooks
  for each row execute function public.set_updated_at();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Single-advisor MVP: RLS enabled but policy allows any
-- authenticated user (the one advisor) full access.
-- Extend to per-advisor ownership when multi-advisor is added.

alter table public.clients       enable row level security;
alter table public.irpf_uploads  enable row level security;
alter table public.playbooks     enable row level security;

create policy "Authenticated advisor — full access to clients"
  on public.clients for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated advisor — full access to irpf_uploads"
  on public.irpf_uploads for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated advisor — full access to playbooks"
  on public.playbooks for all
  to authenticated
  using (true)
  with check (true);
