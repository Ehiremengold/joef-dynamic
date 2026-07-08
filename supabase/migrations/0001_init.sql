-- Joef Dynamic College portal — core schema
-- Run in the Supabase SQL editor (or `supabase db push`).

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------
-- updated_at helper
-- ------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------------
-- staff — profile rows linked to Supabase Auth users
-- ------------------------------------------------------------------
create table if not exists public.staff (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  email       text not null unique,
  role        text not null default 'teacher' check (role in ('admin', 'teacher')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger staff_updated_at before update on public.staff
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------
-- students — enrolled roster; login by admission_number + PIN
-- ------------------------------------------------------------------
create table if not exists public.students (
  id                uuid primary key default gen_random_uuid(),
  admission_number  text not null unique,
  full_name         text not null,
  class_name        text not null check (class_name in ('JS1','JS2','JS3','SS1','SS2','SS3')),
  entry_year        text not null,
  pin_hash          text not null,
  active            boolean not null default true,
  created_by        uuid references public.staff (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists students_class_idx on public.students (class_name);
create trigger students_updated_at before update on public.students
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------
-- candidates — entrance applicants (no standing account)
-- ------------------------------------------------------------------
create table if not exists public.candidates (
  id                uuid primary key default gen_random_uuid(),
  candidate_number  text not null unique,
  full_name         text not null,
  parent_phone      text,
  created_at        timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- exams
-- ------------------------------------------------------------------
create table if not exists public.exams (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('entrance', 'class')),
  class_name    text check (class_name in ('JS1','JS2','JS3','SS1','SS2','SS3')),
  title         text not null,
  duration_mins int not null default 30 check (duration_mins between 1 and 180),
  active        boolean not null default false,
  opens_at      timestamptz,
  closes_at     timestamptz,
  created_by    uuid references public.staff (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- class exams must name a class; entrance exams must not
  constraint exam_class_shape check (
    (type = 'class' and class_name is not null) or
    (type = 'entrance' and class_name is null)
  )
);
create index if not exists exams_type_idx on public.exams (type, class_name);
create trigger exams_updated_at before update on public.exams
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------
-- questions
-- ------------------------------------------------------------------
create table if not exists public.questions (
  id            uuid primary key default gen_random_uuid(),
  exam_id       uuid not null references public.exams (id) on delete cascade,
  text          text not null,
  options       jsonb not null,               -- array of strings
  correct_index int not null check (correct_index >= 0),
  position      int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists questions_exam_idx on public.questions (exam_id, position);

-- ------------------------------------------------------------------
-- attempts — one submission per taker per exam
-- ------------------------------------------------------------------
create table if not exists public.attempts (
  id            uuid primary key default gen_random_uuid(),
  exam_id       uuid not null references public.exams (id) on delete cascade,
  exam_title    text not null,
  exam_type     text not null check (exam_type in ('entrance', 'class')),
  taker_type    text not null check (taker_type in ('student', 'candidate')),
  student_id    uuid references public.students (id) on delete set null,
  candidate_id  uuid references public.candidates (id) on delete set null,
  taker_name    text not null,
  class_name    text,
  year          text not null,
  answers       jsonb not null,               -- array of int|null
  score         int not null,
  total         int not null,
  submitted_at  timestamptz not null default now()
);
-- one attempt per exam per taker (partial uniques so NULLs don't collide)
create unique index if not exists attempts_one_per_student
  on public.attempts (exam_id, student_id) where student_id is not null;
create unique index if not exists attempts_one_per_candidate
  on public.attempts (exam_id, candidate_id) where candidate_id is not null;
create index if not exists attempts_exam_idx on public.attempts (exam_id);
create index if not exists attempts_student_idx on public.attempts (student_id);
