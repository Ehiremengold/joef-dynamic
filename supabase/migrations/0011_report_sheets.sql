-- Term report sheets — what the per-term report (and the transcript made of
-- them) needs beyond the raw scores in term_scores.
-- Run after 0001-0010. Then, to fill the two new columns from the legacy
-- export for data that is already loaded:
--   node scripts/import-legacy-export.mjs <export-dir> --report-details

-- The order a class's subjects are listed in on its report sheets
-- (Mathematics and English first, and so on). Unset sorts last, A–Z.
alter table public.class_subjects add column if not exists position int;

-- Printed on the report sheet as "Next Resumption Date".
alter table public.terms add column if not exists next_term_begins date;

-- Class size and class average for a term, as printed on every report sheet.
--
-- A student's term percentage is marks obtained over marks obtainable across
-- the subjects they have a score in. The class average is the mean of those
-- percentages, so a student offering three subjects counts the same as one
-- offering eighteen.
--
-- security_invoker makes the view read term_scores as the caller, so that
-- table's deny-by-default RLS covers the view too.
create or replace view public.term_class_summary
with (security_invoker = true) as
select
  term_id,
  class_id,
  count(*)::int          as students,
  round(avg(percent), 2) as average_percent
from (
  select
    term_id,
    class_id,
    student_id,
    sum(total) * 100.0 / sum(ca_max + exam_max) as percent
  from public.term_scores
  where class_id is not null
  group by term_id, class_id, student_id
) per_student
group by term_id, class_id;

revoke all on public.term_class_summary from anon, authenticated;
grant select on public.term_class_summary to service_role;
