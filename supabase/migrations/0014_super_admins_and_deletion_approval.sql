-- Super admins, exam ownership and deletion approval.
--
-- A teacher can only change exams they created; anyone else's is view only.
-- An admin can work on anyone's exam, but deleting someone else's exam or
-- one of its questions becomes a request that a super admin approves.
-- Super admins can do everything, and manage who else is a super admin.
-- Run after 0001-0013.

alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff add constraint staff_role_check
  check (role in ('teacher', 'admin', 'super_admin'));

-- The school's super admins, and the developer who supports the portal.
update public.staff set role = 'super_admin'
where lower(email) in ('joseagbes@gmail.com', 'edy4excel@gmail.com', 'ehiremengold@gmail.com');

create table if not exists public.deletion_requests (
  id                uuid primary key default gen_random_uuid(),
  -- Set null once the exam is gone, so the record of who asked and who
  -- approved survives the deletion it describes.
  exam_id           uuid references public.exams (id) on delete set null,
  exam_title        text not null,
  -- Null when the whole exam is to go. Questions are re-created on every
  -- save, so one is identified by its content, not its id.
  question_text     text,
  question_options  jsonb,
  reason            text not null,
  requested_by      uuid references public.staff (id) on delete set null,
  status            text not null default 'pending'
                      check (status in ('pending', 'approved', 'rejected', 'obsolete')),
  decided_by        uuid references public.staff (id) on delete set null,
  decided_at        timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists deletion_requests_status_idx on public.deletion_requests (status, created_at desc);

alter table public.deletion_requests enable row level security;
-- No policies: only the service-role API layer can read/write it.
