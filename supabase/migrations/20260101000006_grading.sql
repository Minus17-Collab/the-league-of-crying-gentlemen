-- ============================================================
-- GRADING  (draft grades, trade grades)
-- ============================================================
-- Written by scheduled jobs, never computed in a page request.
-- Recomputing overwrites prior rows for that pick/trade — these
-- are derived data, not source of truth.

-- Draft Night Grade (curved, computed at pick time using ADP) and
-- End-of-Season Regrade (uncurved, VOE-based) share a row per pick;
-- the regrade columns are null until the season is complete.
create table draft_pick_grades (
  id                  uuid primary key default gen_random_uuid(),
  draft_pick_id       uuid not null references draft_picks(id) on delete cascade,
  adp_at_pick         numeric(6,1),          -- preseason ADP, or substitute (see data_gaps)
  reach_value         numeric(6,1),          -- pick_overall - adp_at_pick
  draft_night_grade   text,                  -- 'A+'..'F', curved within draft class
  season_points       numeric(8,2),          -- actual full-season points, this league's scoring
  expected_points     numeric(8,2),          -- from pooled pick-slot decay curve
  voe                 numeric(8,2),          -- season_points - expected_points
  regrade_grade       text,                  -- 'A+'..'F', fixed VOE bands, not curved
  regrade_rank        int,                   -- rank within season by VOE
  computed_at         timestamptz not null default now(),
  unique (draft_pick_id)
);

-- One row per side of a trade. A 3-way trade produces 3 rows sharing
-- transactions.details->>'trade_id'.
create table trade_grades (
  id                  uuid primary key default gen_random_uuid(),
  season_id           uuid not null references seasons(id) on delete cascade,
  trade_id            text not null,         -- matches transactions.details->>'trade_id'
  team_id             uuid not null references teams(id),
  started_points      numeric(8,2) not null, -- points from received players, started only
  total_points        numeric(8,2) not null, -- points from received players, started or not
  evaluation_window    text not null,         -- e.g. 'trade week 6 -> end of regular season'
  verdict             text,                  -- 'neutral' | 'slight_edge' | 'won' | 'fleeced'
  computed_at         timestamptz not null default now(),
  unique (trade_id, team_id)
);

-- Every place ESPN data was missing, ambiguous, or substituted, and
-- what assumption was made. Surfaced in the site's data-gaps report,
-- never silently papered over (see AGENTS.md "ambiguous requirements").
create table data_gaps (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid references seasons(id),
  scope         text not null,          -- 'draft','trade','roster','settings'
  description   text not null,
  assumption    text not null,
  created_at    timestamptz not null default now()
);
