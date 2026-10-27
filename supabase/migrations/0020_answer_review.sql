-- ------------------------------------------------------------------
-- 0020: reviewing answers after a test.
--
-- Staff can see, question by question, what each student answered and what
-- was right; students can too once their teacher allows it.
--
-- 1. attempts.questions: the questions exactly as they were when the test
--    was submitted ([{ text, options, correctIndex }], in order). Questions
--    can be edited later, and an answer means nothing against different
--    wording. Results from before this have none; the portal then compares
--    against the exam's questions as they are now, and says so.
-- 2. exams.review_open: whether students may see their answers and the
--    correct ones. Off until the teacher switches it on, so the first
--    student to finish can't pass the answers to those still to sit it.
--
-- The portal works before this is run (no snapshots are kept, and students
-- can't review); run it to switch both on.
-- ------------------------------------------------------------------

alter table public.attempts add column if not exists questions jsonb;

alter table public.exams add column if not exists review_open boolean not null default false;
