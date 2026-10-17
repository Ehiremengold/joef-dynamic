-- Slowing down PIN guessing at student sign-in.
--
-- A student PIN is 6 digits, so it can be found by trying enough of them.
-- Wrong attempts are counted per key ("adm:<admission number>" and
-- "ip:<address>") in a rolling window; reaching the limit locks that key for
-- a while. The limits themselves live in lib/data/loginThrottle.ts.
-- Run after 0001-0016.

create table if not exists public.login_throttle (
  key                text primary key,
  failures           int not null default 0,
  window_started_at  timestamptz not null default now(),
  locked_until       timestamptz
);

alter table public.login_throttle enable row level security;
-- No policies: only the service-role API layer can read/write it.

-- ------------------------------------------------------------------
-- record_login_failure — count one wrong attempt against each key, in one
-- transaction, so simultaneous attempts can't slip past the limit. A key
-- that reaches its limit is locked and its count starts again.
-- Returns the latest lock this attempt caused, or null.
-- ------------------------------------------------------------------
create or replace function public.record_login_failure(
  p_keys text[],
  p_limits int[],
  p_window_seconds int,
  p_lock_seconds int
)
returns timestamptz
language plpgsql
as $$
declare
  i       int;
  r       public.login_throttle;
  locked  timestamptz;
begin
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
      end
    returning * into r;

    if r.failures >= p_limits[i] then
      update public.login_throttle
         set locked_until = now() + make_interval(secs => p_lock_seconds),
             failures = 0,
             window_started_at = now()
       where key = p_keys[i]
      returning locked_until into r.locked_until;
      locked := greatest(locked, r.locked_until);
    end if;
  end loop;
  return locked;
end;
$$;

-- Only the service-role API layer may call it.
revoke execute on function public.record_login_failure(text[], int[], int, int) from public, anon, authenticated;
