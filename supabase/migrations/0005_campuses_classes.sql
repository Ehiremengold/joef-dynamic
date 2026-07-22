-- Campuses and classes — Class Management.
--
-- A campus (Ikoyi, Obalende) has classes; a class is a level (JS1..SS3) plus
-- an optional "arm" (e.g. "A", "B"). Arms are free text, not a fixed enum,
-- since Ikoyi runs multiple arms per level and Obalende runs a single arm —
-- staff add/rename/remove arms as needed rather than picking from a list.
-- Run after 0001-0004.

create table if not exists public.campuses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.classes (
  id                uuid primary key default gen_random_uuid(),
  campus_id         uuid not null references public.campuses (id) on delete cascade,
  level             text not null check (level in ('JS1','JS2','JS3','SS1','SS2','SS3')),
  arm               text,
  class_teacher_id  uuid references public.staff (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- Distinguish "no arm" classes cleanly: two partial unique indexes rather
-- than one (campus_id, level, arm) index, since arm can be null and nulls
-- never collide in a standard unique index — this closes that gap.
create unique index if not exists classes_unique_with_arm
  on public.classes (campus_id, level, arm) where arm is not null;
create unique index if not exists classes_unique_without_arm
  on public.classes (campus_id, level) where arm is null;
create index if not exists classes_campus_idx on public.classes (campus_id);
create index if not exists classes_teacher_idx on public.classes (class_teacher_id);
create trigger classes_updated_at before update on public.classes
  for each row execute function public.set_updated_at();

-- Additive, nullable — the existing free-text students.class_name (used by
-- exam eligibility matching) is left untouched. Once a student is assigned
-- a real class here, the roster keeps class_name in sync from classes.level.
alter table public.students
  add column if not exists class_id uuid references public.classes (id) on delete set null;
create index if not exists students_class_id_idx on public.students (class_id);

alter table public.campuses enable row level security;
alter table public.classes  enable row level security;
-- No policies: only the service-role API layer can read/write these.
