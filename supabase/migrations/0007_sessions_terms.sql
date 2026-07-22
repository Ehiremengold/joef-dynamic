-- Academic sessions and terms — needed to scope attendance (and, later,
-- class-subject and result-template features) to a specific period.
-- Run after 0001-0006.

create table if not exists public.academic_sessions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique, -- e.g. "2025/2026"
  is_current  boolean not null default false,
  created_at  timestamptz not null default now()
);
-- at most one current session system-wide
create unique index if not exists academic_sessions_one_current
  on public.academic_sessions (is_current) where is_current;

create table if not exists public.terms (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.academic_sessions (id) on delete cascade,
  name        text not null check (name in ('First Term','Second Term','Third Term')),
  is_current  boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (session_id, name)
);
-- at most one current term system-wide
create unique index if not exists terms_one_current
  on public.terms (is_current) where is_current;
create index if not exists terms_session_idx on public.terms (session_id);

alter table public.academic_sessions  enable row level security;
alter table public.terms              enable row level security;
-- No policies: only the service-role API layer can read/write these.
