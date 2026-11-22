-- Saving term scores safely when several people work at once.
--
-- Before, a save wrote both the CA and the exam mark of every student it
-- touched, from what the sheet showed when it was opened. A teacher fixing a
-- CA mark could wipe an exam mark an admin had sent from the CBT a minute
-- earlier, and two people saving one sheet silently overwrote each other.
--
-- Now every save (the score sheet, and sending CBT results) goes through
-- save_term_scores: it writes only the parts that were changed, and only if
-- each of them is still what the person saw. If any is not, nothing is
-- written and the students concerned are returned, so they can be shown.
-- Run after 0001-0020.

-- ------------------------------------------------------------------
-- save_term_scores — write some students' marks for one subject and term,
-- all or nothing.
--
-- p_rows: [{ student_id, class_id,
--            set_ca, ca, was_ca,          -- set_ca: write ca (null clears it)
--            set_exam, exam, was_exam }]  -- was_*: the mark the person saw
-- A student left with neither mark loses their row.
--
-- Returns { saved, cleared } or, when someone else got there first,
-- { conflicts: [{ student_id, ca, exam }] } with the marks as they are now.
-- ------------------------------------------------------------------
create or replace function public.save_term_scores(
  p_term_id uuid,
  p_subject_id uuid,
  p_rows jsonb,
  p_ca_max int,
  p_exam_max int
)
returns jsonb
language plpgsql
as $$
declare
  r          jsonb;
  cur        public.term_scores;
  set_ca     boolean;
  set_exam   boolean;
  new_ca     numeric;
  new_exam   numeric;
  conflicts  jsonb := '[]'::jsonb;
  saved      int := 0;
  cleared    int := 0;
begin
  -- One save at a time per subject sheet, so a row that doesn't exist yet
  -- can't be created by two saves at once (row locks only cover rows that exist).
  perform pg_advisory_xact_lock(hashtextextended(p_term_id::text || '/' || p_subject_id::text, 0));

  -- Check every row before writing any.
  for r in select * from jsonb_array_elements(p_rows) loop
    select * into cur from public.term_scores
     where term_id = p_term_id and subject_id = p_subject_id and student_id = (r->>'student_id')::uuid
     for update;
    set_ca := coalesce((r->>'set_ca')::boolean, false);
    set_exam := coalesce((r->>'set_exam')::boolean, false);
    if (set_ca and cur.ca_score is distinct from (r->>'was_ca')::numeric)
       or (set_exam and cur.exam_score is distinct from (r->>'was_exam')::numeric) then
      conflicts := conflicts || jsonb_build_object(
        'student_id', r->>'student_id', 'ca', cur.ca_score, 'exam', cur.exam_score);
    end if;
  end loop;
  if jsonb_array_length(conflicts) > 0 then
    return jsonb_build_object('conflicts', conflicts);
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    select * into cur from public.term_scores
     where term_id = p_term_id and subject_id = p_subject_id and student_id = (r->>'student_id')::uuid;
    set_ca := coalesce((r->>'set_ca')::boolean, false);
    set_exam := coalesce((r->>'set_exam')::boolean, false);
    new_ca := case when set_ca then (r->>'ca')::numeric else cur.ca_score end;
    new_exam := case when set_exam then (r->>'exam')::numeric else cur.exam_score end;

    if new_ca is null and new_exam is null then
      delete from public.term_scores
       where term_id = p_term_id and subject_id = p_subject_id and student_id = (r->>'student_id')::uuid;
      if found then cleared := cleared + 1; end if;
    else
      insert into public.term_scores as t
        (student_id, subject_id, term_id, class_id, ca_score, exam_score, ca_max, exam_max)
      values
        ((r->>'student_id')::uuid, p_subject_id, p_term_id, (r->>'class_id')::uuid, new_ca, new_exam, p_ca_max, p_exam_max)
      on conflict (student_id, subject_id, term_id) do update set
        class_id = excluded.class_id,
        ca_score = excluded.ca_score,
        exam_score = excluded.exam_score,
        ca_max = excluded.ca_max,
        exam_max = excluded.exam_max;
      saved := saved + 1;
    end if;
  end loop;

  return jsonb_build_object('saved', saved, 'cleared', cleared);
end;
$$;

revoke execute on function public.save_term_scores(uuid, uuid, jsonb, int, int) from public, anon, authenticated;
