-- Row Level Security — defense in depth.
--
-- The app's API routes use the SERVICE ROLE key, which bypasses RLS, and are the
-- primary gatekeeper (they authorize each request and strip correct answers).
-- These policies ensure that even if the ANON key were ever used against these
-- tables directly (e.g. a misconfigured client), nothing sensitive is exposed:
-- everything is deny-by-default. No anon/authenticated policies are granted for
-- reads of questions.correct_index or attempts.

alter table public.staff       enable row level security;
alter table public.students    enable row level security;
alter table public.candidates  enable row level security;
alter table public.exams       enable row level security;
alter table public.questions   enable row level security;
alter table public.attempts    enable row level security;

-- A signed-in staff member may read their own profile (used by the browser
-- session bootstrap). Everything else has no policy → denied for anon/auth roles.
create policy staff_read_self on public.staff
  for select using (auth.uid() = id);

-- No other policies: anon and authenticated roles cannot read students,
-- candidates, exams, questions, or attempts directly. All legitimate access
-- flows through the service-role API layer.
