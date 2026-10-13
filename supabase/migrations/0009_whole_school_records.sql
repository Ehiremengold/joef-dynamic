-- Whole-school records — everything the legacy data export carries that the
-- portal had nowhere to put: pre-secondary levels, student bio details,
-- parents, and per-term CA/exam scores.
-- Run after 0001-0008, before scripts/import-legacy-export.mjs.

-- ------------------------------------------------------------------
-- Levels — the school runs KG through SS3, not just JS1..SS3.
-- Keep this list in step with CLASSES in lib/types.ts.
-- ------------------------------------------------------------------
alter table public.students drop constraint if exists students_class_name_check;
alter table public.students add constraint students_class_name_check
  check (class_name in ('KG1','KG2','NUR1','NUR2','BS1','BS2','BS3','BS4','BS5',
                        'JS1','JS2','JS3','SS1','SS2','SS3'));

alter table public.exams drop constraint if exists exams_class_name_check;
alter table public.exams add constraint exams_class_name_check
  check (class_name in ('KG1','KG2','NUR1','NUR2','BS1','BS2','BS3','BS4','BS5',
                        'JS1','JS2','JS3','SS1','SS2','SS3'));

alter table public.classes drop constraint if exists classes_level_check;
alter table public.classes add constraint classes_level_check
  check (level in ('KG1','KG2','NUR1','NUR2','BS1','BS2','BS3','BS4','BS5',
                   'JS1','JS2','JS3','SS1','SS2','SS3'));

-- ------------------------------------------------------------------
-- Student bio details — all optional; the legacy records are patchy.
-- ------------------------------------------------------------------
alter table public.students
  add column if not exists gender         text check (gender in ('male','female')),
  add column if not exists date_of_birth  date,
  add column if not exists address        text,
  add column if not exists phone          text;

-- ------------------------------------------------------------------
-- Parents — contact records only (no login). One parent record can cover
-- several children, and a child can have more than one.
-- ------------------------------------------------------------------
create table if not exists public.parents (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  full_name   text not null,
  email       text unique,
  phone       text,
  address     text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger parents_updated_at before update on public.parents
  for each row execute function public.set_updated_at();

create table if not exists public.student_parents (
  student_id  uuid not null references public.students (id) on delete cascade,
  parent_id   uuid not null references public.parents (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (student_id, parent_id)
);
create index if not exists student_parents_parent_idx on public.student_parents (parent_id);

-- ------------------------------------------------------------------
-- term_scores — one row per student per subject per term: the continuous
-- assessment and exam marks that make up a report card.
--
-- class_id is the class the student sat in *that term*, which for past
-- sessions differs from students.class_id (their class today).
-- Either mark may be missing (absent for the exam, CA never entered), but
-- not both — a row with no marks at all is just noise.
-- Subjects and terms are `restrict`, not `cascade`: deleting one must never
-- silently take years of results with it.
-- ------------------------------------------------------------------
create table if not exists public.term_scores (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students (id) on delete cascade,
  subject_id  uuid not null references public.subjects (id) on delete restrict,
  term_id     uuid not null references public.terms (id) on delete restrict,
  class_id    uuid references public.classes (id) on delete set null,
  ca_score    numeric(5,2) check (ca_score >= 0),
  exam_score  numeric(5,2) check (exam_score >= 0),
  ca_max      int not null default 40 check (ca_max > 0),
  exam_max    int not null default 60 check (exam_max > 0),
  total       numeric(6,2) generated always as
                (coalesce(ca_score, 0) + coalesce(exam_score, 0)) stored,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (student_id, subject_id, term_id),
  constraint term_scores_has_a_mark check (ca_score is not null or exam_score is not null)
);
create index if not exists term_scores_term_class_idx on public.term_scores (term_id, class_id);
create index if not exists term_scores_subject_idx on public.term_scores (subject_id);
create trigger term_scores_updated_at before update on public.term_scores
  for each row execute function public.set_updated_at();

alter table public.parents          enable row level security;
alter table public.student_parents  enable row level security;
alter table public.term_scores      enable row level security;
-- No policies: only the service-role API layer can read/write these.
