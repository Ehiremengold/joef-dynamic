-- Promotion — moving students up a class at the end of a session.
--
-- One row per student per session they were moved into: promoted to a new
-- class, kept back (repeated), or graduated (SS3 leavers, made inactive).
-- The row is what stops a student being promoted twice into the same
-- session, and it carries enough to undo the move exactly.
--
-- Past results are not touched: term_scores keep the class the student sat
-- in that term, so old report sheets still print the old class.
-- Run after 0001-0014.

create table if not exists public.student_promotions (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.students (id) on delete cascade,
  -- The session the student moves into, e.g. 2026/2027.
  session_id     uuid not null references public.academic_sessions (id) on delete restrict,
  from_class_id  uuid references public.classes (id) on delete set null,
  from_level     text not null,
  -- Null for a graduate; the same class as from_class_id for a repeat.
  to_class_id    uuid references public.classes (id) on delete set null,
  outcome        text not null check (outcome in ('promoted', 'repeated', 'graduated')),
  -- Whether the student was active before, so undoing a graduation restores it.
  was_active     boolean not null,
  promoted_by    uuid references public.staff (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (student_id, session_id)
);
create index if not exists student_promotions_session_from_idx
  on public.student_promotions (session_id, from_class_id);

alter table public.student_promotions enable row level security;
-- No policies: only the service-role API layer can read/write it.

-- ------------------------------------------------------------------
-- promote_students — apply one class's promotion in a single transaction.
-- p_moves: [{ "studentId": uuid, "outcome": "promoted"|"repeated"|"graduated",
--             "toClassId": uuid (promoted only) }]
-- Any failure (a student already moved into the session, a missing class)
-- rolls the whole call back, so a class is never left half-promoted.
-- ------------------------------------------------------------------
create or replace function public.promote_students(p_session_id uuid, p_staff_id uuid, p_moves jsonb)
returns integer
language plpgsql
as $$
declare
  m          jsonb;
  s          record;
  v_outcome  text;
  v_to       uuid;
  v_level    text;
  n          integer := 0;
begin
  for m in select * from jsonb_array_elements(p_moves) loop
    v_outcome := m->>'outcome';
    v_to := nullif(m->>'toClassId', '')::uuid;

    select id, class_id, class_name, active into s
      from public.students where id = (m->>'studentId')::uuid for update;
    if not found then
      raise exception 'Student % not found', m->>'studentId';
    end if;

    if v_outcome = 'promoted' then
      select level into v_level from public.classes where id = v_to;
      if v_level is null then
        raise exception 'Class % not found', v_to;
      end if;
    elsif v_outcome = 'repeated' then
      v_to := s.class_id;
    elsif v_outcome = 'graduated' then
      v_to := null;
    else
      raise exception 'Unknown outcome %', v_outcome;
    end if;

    insert into public.student_promotions
      (student_id, session_id, from_class_id, from_level, to_class_id, outcome, was_active, promoted_by)
    values
      (s.id, p_session_id, s.class_id, s.class_name, v_to, v_outcome, s.active, p_staff_id);

    if v_outcome = 'promoted' then
      update public.students set class_id = v_to, class_name = v_level where id = s.id;
    elsif v_outcome = 'graduated' then
      update public.students set active = false where id = s.id;
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ------------------------------------------------------------------
-- undo_promotion — put a student back where they were and forget the move.
-- ------------------------------------------------------------------
create or replace function public.undo_promotion(p_promotion_id uuid)
returns void
language plpgsql
as $$
declare
  p record;
begin
  select * into p from public.student_promotions where id = p_promotion_id for update;
  if not found then
    raise exception 'Promotion not found';
  end if;
  update public.students
     set class_id = p.from_class_id, class_name = p.from_level, active = p.was_active
   where id = p.student_id;
  delete from public.student_promotions where id = p.id;
end;
$$;

-- Only the service-role API layer may call these.
revoke execute on function public.promote_students(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.undo_promotion(uuid) from public, anon, authenticated;
