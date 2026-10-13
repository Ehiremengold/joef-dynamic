-- Keep results when their exam is deleted.
--
-- attempts.exam_id was `on delete cascade`, so deleting an exam silently took
-- every result ever recorded for it — while the staff screen promises
-- "Results already taken are kept". An attempt already carries its own copy
-- of the exam title and type, so it reads fine without the exam row; only
-- the link is cleared.
-- Run after 0001-0009.

alter table public.attempts alter column exam_id drop not null;

alter table public.attempts drop constraint if exists attempts_exam_id_fkey;
alter table public.attempts add constraint attempts_exam_id_fkey
  foreign key (exam_id) references public.exams (id) on delete set null;
