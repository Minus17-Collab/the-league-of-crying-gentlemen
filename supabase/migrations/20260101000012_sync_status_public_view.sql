-- ============================================================
-- PUBLIC SYNC STATUS VIEW
-- ============================================================
-- `sync_runs` itself stays authenticated-read (it can carry internal
-- failure messages), but the public site's footer wants one honest,
-- non-sensitive fact: when data was last successfully refreshed from
-- ESPN. Expose only that, via a narrow view rather than opening up
-- sync_runs itself.
--
-- Deliberately NOT security_invoker: this view must run as its owner
-- (bypassing sync_runs' authenticated-only RLS) so anon can read the
-- single aggregated timestamp below, without ever gaining access to
-- sync_runs' rows, messages, or scopes directly.

create view public_sync_status as
select max(finished_at) as last_successful_sync_at
from sync_runs
where status = 'success';

grant select on public_sync_status to anon, authenticated;
