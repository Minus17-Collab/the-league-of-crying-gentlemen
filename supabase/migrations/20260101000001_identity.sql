-- ============================================================
-- IDENTITY: leagues, franchises, seasons, teams
-- ============================================================
-- See schema.sql (schema of record) for full design rationale.

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
