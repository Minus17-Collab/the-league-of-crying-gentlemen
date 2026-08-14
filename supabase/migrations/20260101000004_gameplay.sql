-- ============================================================
-- GAMEPLAY
-- ============================================================

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
