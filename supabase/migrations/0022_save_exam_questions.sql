-- Saving a test's questions safely when it is open in more than one place.
--
-- Before, a save deleted all of a test's questions and inserted the list the
-- teacher's screen was holding, in two separate steps. So:
--  * a save from an older copy of the test (another tab, a phone, another
--    teacher) silently put back that older list, erasing newer questions;
--  * if the insert failed after the delete, the test was left with none.
--
-- Now every save goes through save_exam_questions: one transaction, and only
-- if the test's questions are still the ones the person saw. Every save gives
-- the questions new ids, so the list of ids is the test's version.
-- Run after 0001-0021.

-- ------------------------------------------------------------------
-- save_exam_questions — replace one test's questions, all or nothing.
--
-- p_expected: the question ids the person saw, in order, or null to skip the
--             check (a screen from before this migration sends none).
-- p_questions: [{ "text": text, "options": [text, ...], "correctIndex": int }]
--
-- Returns { saved: n } or, when the questions changed since the person saw
-- them, { conflict: true, count: n } with how many the test has now.
-- ------------------------------------------------------------------
create or replace function public.save_exam_questions(p_exam_id uuid, p_expected uuid[], p_questions jsonb)
returns jsonb
language plpgsql
as $$
declare
  current_ids uuid[];
begin
  -- One save at a time per test: the second waits, then sees the first's ids.
  perform 1 from public.exams where id = p_exam_id for update;
  if not found then
    raise exception 'Exam not found';
  end if;

  select coalesce(array_agg(id order by position, id), '{}') into current_ids
    from public.questions where exam_id = p_exam_id;
  if p_expected is not null and current_ids is distinct from p_expected then
    return jsonb_build_object('conflict', true, 'count', coalesce(array_length(current_ids, 1), 0));
  end if;

  delete from public.questions where exam_id = p_exam_id;
  insert into public.questions (exam_id, text, options, correct_index, position)
  select p_exam_id, q->>'text', q->'options', (q->>'correctIndex')::int, (n - 1)::int
    from jsonb_array_elements(p_questions) with ordinality as t(q, n);

  return jsonb_build_object('saved', jsonb_array_length(p_questions));
end;
$$;

-- Only the service-role API layer may call it.
revoke execute on function public.save_exam_questions(uuid, uuid[], jsonb) from public, anon, authenticated;
