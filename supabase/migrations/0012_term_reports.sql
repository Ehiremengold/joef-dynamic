-- Term reports — what a class teacher adds to each student's report sheet
-- for a term: the "Effective Areas" ratings and the teacher's comment.
-- (The principal's comment is not stored: it is written from the student's
-- overall performance when the sheet is printed.)
-- Run after 0001-0011.

create table if not exists public.term_reports (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students (id) on delete cascade,
  term_id          uuid not null references public.terms (id) on delete cascade,
  ratings          jsonb not null default '{}'::jsonb,  -- trait name → rating
  teacher_comment  text,
  updated_by       uuid references public.staff (id) on delete set null,
  updated_at       timestamptz not null default now(),
  unique (student_id, term_id)
);
create index if not exists term_reports_term_idx on public.term_reports (term_id);
create trigger term_reports_updated_at before update on public.term_reports
  for each row execute function public.set_updated_at();

alter table public.term_reports enable row level security;
-- No policies: only the service-role API layer can read/write it.
