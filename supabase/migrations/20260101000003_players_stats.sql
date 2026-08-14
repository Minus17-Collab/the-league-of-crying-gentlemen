-- ============================================================
-- PLAYERS & STATS  (provider-agnostic layer)
-- ============================================================

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
