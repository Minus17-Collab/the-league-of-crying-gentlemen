-- ============================================================
-- LEAGUE RECORDS
-- ============================================================
-- Backs ROADMAP.md 3.2 "Record book" and 3.5.1 "Derived stats".
-- `record_definitions` (migration 5) already exists but was never
-- populated or read anywhere. This adds the results table it was
-- designed for.
--
-- Unlike ROADMAP 3.2's suggestion of "each definition maps to a
-- registered SQL view", results here are computed and written by
-- scripts/compute-records.mjs (mirroring src/lib/records/engine.ts),
-- the same "script computes -> table stores -> page reads" pattern
-- already used for draft_pick_grades/trade_grades. Several record
-- categories (win/loss streaks that can cross a season boundary,
-- all-play luck ranking) need procedural logic that is fragile to
-- express as a single SQL view, and this repo already has a working
-- precedent for that tradeoff.
--
-- One row per (record definition, scope, holder) -- ties are simply
-- multiple rows sharing the same `value`, so there is no code path
-- that could arbitrarily break a tie (see AGENTS.md "When
-- requirements are ambiguous" / the records feature's "ties share the
-- record" rule).
create table record_results (
  id                    uuid primary key default gen_random_uuid(),
  record_definition_id  uuid not null references record_definitions(id) on delete cascade,
  scope                 text not null check (scope in ('alltime', 'season')),
  season_year           int,              -- set when scope = 'season'; null for 'alltime'
  is_playoff            boolean not null default false,
  franchise_id          uuid not null references franchises(id),
  value                 numeric(10, 2) not null,
  -- Extra context for spot-checking (week number, opposing franchise,
  -- streak start/end, per-week all-play rank, etc.) -- shape varies by
  -- record key, see src/lib/records/engine.ts for what each key writes.
  context               jsonb not null default '{}',
  computed_at           timestamptz not null default now(),
  constraint record_results_season_year_check
    check ((scope = 'season' and season_year is not null) or (scope = 'alltime' and season_year is null))
);

create index record_results_lookup on record_results (record_definition_id, scope, season_year);

alter table record_results enable row level security;

create policy "public read record_results" on record_results
  for select using (true);
