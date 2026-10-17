-- Closing a gap in the sign-in throttle (0017): the lock was checked before
-- the PIN and only counted after it, so a burst of guesses sent at the same
-- moment could all pass the check before any was counted. Now an attempt is
-- counted *before* the PIN is checked, in one statement per key, and a
-- correct PIN hands its count back.
-- Run after 0001-0018.

-- ------------------------------------------------------------------
-- claim_login_attempt — count one attempt against each key and say whether
-- it may go ahead. A key already locked refuses without counting; a key
-- whose count passes its limit becomes locked and refuses. Concurrent claims
-- on one key queue on its row, so each sees the others' counts.
-- Returns the lock refusing this attempt, or null when it may proceed.
-- ------------------------------------------------------------------
create or replace function public.claim_login_attempt(
  p_keys text[],
  p_limits int[],
  p_window_seconds int,
  p_lock_seconds int
)
returns jsonb
language plpgsql
as $$
declare
  i  int;
  r  public.login_throttle;
begin
  -- A lock on any key refuses straight away, and counts nothing.
  select * into r from public.login_throttle
   where key = any(p_keys) and locked_until > now()
   order by locked_until desc limit 1;
  if found then
    return jsonb_build_object('key', r.key, 'locked_until', r.locked_until);
  end if;

  for i in 1 .. coalesce(array_length(p_keys, 1), 0) loop
    insert into public.login_throttle as t (key, failures, window_started_at)
    values (p_keys[i], 1, now())
    on conflict (key) do update set
      failures = case
        when t.window_started_at < now() - make_interval(secs => p_window_seconds) then 1
        else t.failures + 1
      end,
      window_started_at = case
        when t.window_started_at < now() - make_interval(secs => p_window_seconds) then now()
        else t.window_started_at
      end,
      locked_until = null
    returning * into r;

    if r.failures > p_limits[i] then
      update public.login_throttle
         set locked_until = now() + make_interval(secs => p_lock_seconds),
             failures = 0,
             window_started_at = now()
       where key = p_keys[i]
      returning * into r;
      return jsonb_build_object('key', r.key, 'locked_until', r.locked_until);
    end if;
  end loop;
  return null;
end;
$$;

-- ------------------------------------------------------------------
-- release_login_attempt — a correct PIN: the student's count is cleared, and
-- the attempt is taken back off the address's count (a lab of students all
-- signing in correctly must never add up to a lock).
-- ------------------------------------------------------------------
create or replace function public.release_login_attempt(p_student_key text, p_address_key text)
returns void
language sql
as $$
  delete from public.login_throttle where key = p_student_key;
  update public.login_throttle set failures = greatest(failures - 1, 0)
   where key = p_address_key and failures > 0;
$$;

revoke execute on function public.claim_login_attempt(text[], int[], int, int) from public, anon, authenticated;
revoke execute on function public.release_login_attempt(text, text) from public, anon, authenticated;
