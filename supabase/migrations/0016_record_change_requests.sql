-- Record changes with approval: editing a student's or staff member's
-- details. An admin's edit waits here until a super admin approves it; a
-- super admin's own edit is applied straight away and recorded here too, so
-- every change to a record has an author, a reason and a decider.
-- Run after 0001-0015.

create table if not exists public.record_change_requests (
  id            uuid primary key default gen_random_uuid(),
  record_type   text not null check (record_type in ('student', 'staff')),
  -- No foreign key: one column points at either table. The name is kept so
  -- the history still reads well if the record is later removed.
  record_id     uuid not null,
  record_name   text not null,
  -- { field: new value } and { field: value when asked }, same keys. The
  -- old values let an approval refuse to overwrite a record that has been
  -- changed since the request was made.
  changes       jsonb not null,
  previous      jsonb not null,
  reason        text not null,
  requested_by  uuid references public.staff (id) on delete set null,
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected', 'obsolete')),
  decided_by    uuid references public.staff (id) on delete set null,
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists record_change_requests_status_idx
  on public.record_change_requests (status, created_at desc);
-- One open request per record at a time.
create unique index if not exists record_change_requests_one_pending
  on public.record_change_requests (record_type, record_id) where status = 'pending';

alter table public.record_change_requests enable row level security;
-- No policies: only the service-role API layer can read/write it.
