-- Sign each teacher's comment with the name of the teacher who wrote it, as
-- they were named then. Before this the name was looked up from updated_by,
-- so it changed if someone else later edited the report, and vanished if
-- that staff account was deleted.
-- Run after 0012.

alter table public.term_reports add column if not exists signed_by text;

update public.term_reports r
set signed_by = s.full_name
from public.staff s
where s.id = r.updated_by and r.signed_by is null;
