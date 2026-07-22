-- Subjects — Class Management.
--
-- A subject catalog, which classes offer subjects from (senior secondary
-- classes merge science/art/commercial subjects onto one list), and a
-- per-student exemption so a subject a student isn't taking is excluded
-- from their report card even though their class offers it.
-- Run after 0005.

create table if not exists public.subjects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text,
  department  text check (department in ('science','art','commercial')),
  created_at  timestamptz not null default now()
);
create unique index if not exists subjects_name_idx on public.subjects (name);

create table if not exists public.class_subjects (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes (id) on delete cascade,
  subject_id  uuid not null references public.subjects (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (class_id, subject_id)
);
create index if not exists class_subjects_class_idx on public.class_subjects (class_id);

create table if not exists public.student_subject_exemptions (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students (id) on delete cascade,
  subject_id  uuid not null references public.subjects (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (student_id, subject_id)
);
create index if not exists student_subject_exemptions_student_idx
  on public.student_subject_exemptions (student_id);

alter table public.subjects                    enable row level security;
alter table public.class_subjects               enable row level security;
alter table public.student_subject_exemptions   enable row level security;
-- No policies: only the service-role API layer can read/write these.
