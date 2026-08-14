-- ============================================================
-- MODULAR SCORING  <- this is the ESPN-style part
-- ============================================================

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
