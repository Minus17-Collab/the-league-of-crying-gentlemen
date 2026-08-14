-- ============================================================
-- FANTASY LEAGUE PLATFORM — CORE SCHEMA (Postgres / Supabase)
-- ============================================================
-- Reference copy only. The schema of record is supabase/migrations/
-- (see AGENTS.md "Database"). This file documents design intent in
-- one place; when the two diverge, migrations win. Update both when
-- changing the schema.
-- ============================================================
-- Design goals:
--   1. Scoring, roster slots, and records are DATA, not code.
--   2. Stat data is provider-agnostic, so ESPN -> Sleeper -> Tank01
--      is a config change, not a rewrite.
--   3. Manager identity persists across seasons so history is
--      continuous even when team names change every year.
-- ============================================================


-- ------------------------------------------------------------
-- IDENTITY
-- ------------------------------------------------------------

create table leagues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- A franchise is the PERSISTENT identity. "Team Kyle" may be
-- named something different every year, but it's one franchise
-- across all of league history. All-time records hang off this.
--
-- Manager lifecycle fields (status, og_manager, espn_owner_ids) are the
-- database equivalent of the hand-maintained managers.json described in
-- the Fantasy League HQ spec. They are commissioner-edited, not synced
-- from ESPN automatically — a manager rejoining under a new ESPN account
-- means appending to espn_owner_ids, not creating a new franchise row.
create table franchises (
  id              uuid primary key default gen_random_uuid(),
  league_id       uuid not null references leagues(id) on delete cascade,
  display_name    text not null,          -- canonical name for history pages
  owner_user_id   uuid references auth.users(id),  -- null until they sign up
  founded_year    int,
  is_active       boolean not null default true,
  status          text not null default 'active',  -- 'active' | 'retired'
  og_manager      boolean not null default false,   -- founding-member badge
  espn_owner_ids  text[] not null default '{}',     -- GUIDs; array supports rejoin-under-new-account merges
  retired_season  int,                                -- last season played, if retired
  notes           text,
  created_at      timestamptz not null default now(),
  constraint franchises_status_check check (status in ('active', 'retired'))
);

-- Ingest looks up a franchise by ESPN owner GUID on every sync; any GUID
-- found in ESPN data but absent here is a hard error, not a silent pass
-- (see AGENTS.md "When requirements are ambiguous").
create index franchises_espn_owner_ids_idx on franchises using gin (espn_owner_ids);

-- One row per league per year. Settings live here because they
-- change: scoring tweaks, expansion from 10 to 12 teams, etc.
create table seasons (
  id               uuid primary key default gen_random_uuid(),
  league_id        uuid not null references leagues(id) on delete cascade,
  year             int not null,
  espn_league_id   text,               -- source of truth for 2026
  regular_weeks    int not null default 14,
  playoff_teams    int not null default 6,
  is_locked        boolean not null default false,  -- true once season is final
  created_at       timestamptz not null default now(),
  unique (league_id, year)
);

-- The season-specific team: name, logo, record. Points at the
-- franchise so history stitches together automatically.
create table teams (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references seasons(id) on delete cascade,
  franchise_id  uuid not null references franchises(id),
  name          text not null,
  abbreviation  text,
  logo_url      text,
  espn_team_id  text,                  -- for syncing
  draft_slot    int,
  unique (season_id, franchise_id)
);


-- ------------------------------------------------------------
-- MODULAR SCORING  <- this is the ESPN-style part
-- ------------------------------------------------------------

-- The vocabulary of trackable stats. Adding "punt return TD"
-- to your league is an INSERT here, never a code change.
create table stat_categories (
  key           text primary key,      -- 'pass_yd', 'rush_td', 'rec', 'fg_40_49'
  display_name  text not null,
  unit          text,                  -- 'yards', 'count'
  applies_to    text[] not null        -- '{QB,RB,WR,TE}' or '{K}' or '{DST}'
);

-- Scoring is scoped to a season, so 2026 rules and 2029 rules
-- coexist and old games always re-score correctly.
--
-- Threshold fields handle bonuses: "300+ passing yards = +3"
-- becomes min_value=300, points_per_unit=0, flat_bonus=3.
create table scoring_rules (
  id               uuid primary key default gen_random_uuid(),
  season_id        uuid not null references seasons(id) on delete cascade,
  stat_key         text not null references stat_categories(key),
  points_per_unit  numeric(8,4) not null default 0,   -- 0.04 for 1pt/25yd
  flat_bonus       numeric(8,4) not null default 0,
  min_value        numeric(10,2),      -- null = no threshold
  max_value        numeric(10,2),
  position_filter  text[],             -- null = applies to all
  sort_order       int not null default 0
);

-- Roster construction, also data. Going from 1 to 2 flex spots
-- in 2028 is an INSERT, not a migration.
create table roster_slots (
  id                uuid primary key default gen_random_uuid(),
  season_id         uuid not null references seasons(id) on delete cascade,
  slot_code         text not null,      -- 'QB','RB','WR','FLEX','BE','IR'
  eligible_positions text[] not null,   -- FLEX = '{RB,WR,TE}'
  count             int not null,
  is_starting_slot  boolean not null default true,
  sort_order        int not null default 0
);


-- ------------------------------------------------------------
-- PLAYERS & STATS  (provider-agnostic layer)
-- ------------------------------------------------------------

create table players (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  position      text not null,
  nfl_team      text,
  created_at    timestamptz not null default now()
);

-- The swap layer. Every provider numbers players differently;
-- this table is what lets you change data sources without
-- touching a single row of stats or scoring.
create table player_external_ids (
  player_id     uuid not null references players(id) on delete cascade,
  provider      text not null,          -- 'espn','sleeper','tank01','nflverse'
  external_id   text not null,
  primary key (provider, external_id)
);

-- Normalized stat lines. One row per player/week/stat.
-- Deliberately NOT a wide table: a tall table means new stat
-- categories never require an ALTER TABLE.
create table stat_lines (
  id           bigserial primary key,
  player_id    uuid not null references players(id) on delete cascade,
  year         int not null,
  week         int not null,
  stat_key     text not null references stat_categories(key),
  value        numeric(10,2) not null,
  source       text not null,           -- which provider supplied it
  updated_at   timestamptz not null default now(),
  unique (player_id, year, week, stat_key)
);

create index stat_lines_lookup on stat_lines (year, week, player_id);


-- ------------------------------------------------------------
-- GAMEPLAY
-- ------------------------------------------------------------

create table matchups (
  id              uuid primary key default gen_random_uuid(),
  season_id       uuid not null references seasons(id) on delete cascade,
  week            int not null,
  home_team_id    uuid not null references teams(id),
  away_team_id    uuid not null references teams(id),
  home_score      numeric(8,2),
  away_score      numeric(8,2),
  is_playoff      boolean not null default false,
  is_championship boolean not null default false,
  is_final        boolean not null default false
);

-- Who was started, and where. Enables "most points left on the
-- bench" — the record every league argues about.
create table lineup_entries (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references teams(id) on delete cascade,
  week         int not null,
  player_id    uuid not null references players(id),
  slot_code    text not null,
  is_starter   boolean not null,
  points       numeric(8,2),            -- cached score at time of scoring
  unique (team_id, week, player_id)
);

create table transactions (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references seasons(id) on delete cascade,
  week          int,
  type          text not null,          -- 'add','drop','trade','waiver'
  team_id       uuid references teams(id),
  counterparty_team_id uuid references teams(id),  -- trades only
  faab_spent    numeric(8,2),
  occurred_at   timestamptz not null,
  details       jsonb                   -- players involved
);

create table draft_picks (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references seasons(id) on delete cascade,
  round         int not null,
  pick_in_round int not null,
  overall_pick  int not null,
  team_id       uuid not null references teams(id),
  player_id     uuid references players(id),
  keeper        boolean not null default false,
  auction_cost  numeric(8,2),
  unique (season_id, overall_pick)
);


-- ------------------------------------------------------------
-- MODULAR RECORDS & AWARDS
-- ------------------------------------------------------------

-- Records are defined as data too. Adding "worst loss as a
-- favorite" to your record book means inserting a row with the
-- query fragment, not deploying new code.
create table record_definitions (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references leagues(id) on delete cascade,
  key           text not null,
  title         text not null,          -- 'Most Points, Single Week'
  description   text,
  scope         text not null,          -- 'week','season','alltime'
  direction     text not null default 'desc',  -- desc = highest wins
  query_name    text not null,          -- maps to a registered SQL view
  is_featured   boolean not null default false,
  sort_order    int not null default 0,
  unique (league_id, key)
);

-- Hand-entered honors: trophy winners, punishments, side bets.
create table awards (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references seasons(id) on delete cascade,
  franchise_id  uuid references franchises(id),
  title         text not null,
  note          text
);


-- ------------------------------------------------------------
-- GRADING  (draft grades, trade grades)
-- ------------------------------------------------------------
-- Written by scheduled jobs (compute.ts equivalent), never computed
-- in a page request. Recomputing overwrites prior rows for that
-- season/pick — these are derived data, not source of truth.

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


-- ------------------------------------------------------------
-- SYNC BOOKKEEPING
-- ------------------------------------------------------------

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
