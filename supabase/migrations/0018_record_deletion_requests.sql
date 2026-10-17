-- Deleting a student, with the same approval as editing one: an admin's
-- deletion waits for a super admin; a super admin's own happens at once and
-- is recorded. A request is now either an edit or a delete.
-- Run after 0001-0017.

alter table public.record_change_requests
  add column if not exists action text not null default 'edit'
    check (action in ('edit', 'delete'));
