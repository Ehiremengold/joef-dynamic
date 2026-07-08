-- Entrance access code — a single shared code that gates the common entrance test.
-- Staff set a code, activate it on test day, and deactivate/clear it afterwards.
-- Run in the Supabase SQL editor after 0001 and 0002.

create table if not exists public.entrance_access (
  id          smallint primary key default 1 check (id = 1), -- single-row config
  code        text,
  active      boolean not null default false,
  updated_at  timestamptz not null default now()
);

insert into public.entrance_access (id, code, active)
  values (1, null, false)
  on conflict (id) do nothing;

alter table public.entrance_access enable row level security;
-- No policies: only the service-role API layer can read/write it.
