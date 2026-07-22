-- Attendance — Class Management.
--
-- Manual, non-permanent entry: class teachers record a class's total school
-- days for a term once, and each student's days-present separately. Both
-- are freely editable at any time (no locking/finalization), and feed the
-- attendance line on the branded result-slip PDF.
-- Run after 0005-0007.

create table if not exists public.class_term_attendance (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes (id) on delete cascade,
  term_id     uuid not null references public.terms (id) on delete cascade,
  total_days  int not null default 0 check (total_days >= 0),
  updated_by  uuid references public.staff (id) on delete set null,
  updated_at  timestamptz not null default now(),
  unique (class_id, term_id)
);
create trigger class_term_attendance_updated_at before update on public.class_term_attendance
  for each row execute function public.set_updated_at();

create table if not exists public.student_attendance (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students (id) on delete cascade,
  term_id       uuid not null references public.terms (id) on delete cascade,
  days_present  int not null default 0 check (days_present >= 0),
  updated_by    uuid references public.staff (id) on delete set null,
  updated_at    timestamptz not null default now(),
  unique (student_id, term_id)
);
create index if not exists student_attendance_term_idx on public.student_attendance (term_id);
create trigger student_attendance_updated_at before update on public.student_attendance
  for each row execute function public.set_updated_at();

alter table public.class_term_attendance  enable row level security;
alter table public.student_attendance     enable row level security;
-- No policies: only the service-role API layer can read/write these.
