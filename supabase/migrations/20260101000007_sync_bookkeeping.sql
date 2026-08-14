-- ============================================================
-- SYNC BOOKKEEPING
-- ============================================================

-- Every sync run gets logged so that when ESPN changes an
-- endpoint mid-season you can see exactly when data went stale.
create table sync_runs (
  id            bigserial primary key,
  provider      text not null,
  scope         text not null,          -- 'rosters','stats','matchups'
  season_id     uuid references seasons(id),
  week          int,
  status        text not null,          -- 'success','partial','failed'
  message       text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);
