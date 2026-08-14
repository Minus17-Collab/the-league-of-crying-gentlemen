-- ============================================================
-- MODULAR RECORDS & AWARDS
-- ============================================================

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
