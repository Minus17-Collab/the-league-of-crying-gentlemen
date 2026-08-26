-- ============================================================
-- TEAM STANDINGS + SEASON FORMAT
-- ============================================================
-- Additive columns to support the public history site's standings
-- and format display without recomputing ESPN's own final rank /
-- playoff seed / tiebreaker logic. Values are sourced from ESPN's
-- own season-end team records and league settings, not derived.

alter table teams
  add column wins int,
  add column losses int,
  add column ties int not null default 0,
  add column points_for numeric(8,2),
  add column points_against numeric(8,2),
  add column final_rank int,
  add column playoff_seed int;

alter table seasons
  add column divisions jsonb,                 -- [{ "name": "...", "size": n }, ...]
  add column playoff_matchup_period_length int,
  add column draft_type text,
  add column keeper_count int;
