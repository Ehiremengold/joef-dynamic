-- attempt_sessions — a test that has been started but not yet submitted.
--
-- Answers are autosaved here as the taker clicks, so a refresh, a flat battery
-- or a dropped connection never loses work. The clock is derived from the
-- server: deadline = started_at + exam.duration_mins + extra_seconds. It keeps
-- running while the taker is away, so closing the tab buys no thinking time;
-- staff grant extra_seconds when an outage was genuine.
--
-- The row is deleted once the attempt is submitted — `attempts` is the record
-- of a finished sitting, this table only ever holds sittings in flight.

create table if not exists public.attempt_sessions (
  id             uuid primary key default gen_random_uuid(),
  exam_id        uuid not null references public.exams (id) on delete cascade,
  student_id     uuid references public.students (id) on delete cascade,
  candidate_id   uuid references public.candidates (id) on delete cascade,
  taker_name     text not null,
  answers        jsonb not null default '[]'::jsonb,  -- array of int|null
  started_at     timestamptz not null default now(),
  extra_seconds  int not null default 0 check (extra_seconds >= 0),
  last_seen_at   timestamptz not null default now(),
  constraint attempt_session_taker check (
    (student_id is not null and candidate_id is null) or
    (student_id is null and candidate_id is not null)
  )
);

-- one live sitting per exam per taker (partial uniques so NULLs don't collide)
create unique index if not exists attempt_sessions_one_per_student
  on public.attempt_sessions (exam_id, student_id) where student_id is not null;
create unique index if not exists attempt_sessions_one_per_candidate
  on public.attempt_sessions (exam_id, candidate_id) where candidate_id is not null;
create index if not exists attempt_sessions_exam_idx on public.attempt_sessions (exam_id);

-- Deny-by-default, same as every other table: all access goes through the
-- service-role API layer, which authorizes each request.
alter table public.attempt_sessions enable row level security;
