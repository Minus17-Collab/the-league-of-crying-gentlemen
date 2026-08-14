-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Default deny on every table (see AGENTS.md "RLS is on for every
-- table. Default deny."). Public read is granted only on the
-- tables that power the public history site. Everything else is
-- authenticated-read for now; write policies are added in Phase 4
-- (commissioner tools) — until then, writes are service-role only,
-- which bypasses RLS entirely and needs no policy.

alter table leagues enable row level security;
alter table franchises enable row level security;
alter table seasons enable row level security;
alter table teams enable row level security;
alter table stat_categories enable row level security;
alter table scoring_rules enable row level security;
alter table roster_slots enable row level security;
alter table players enable row level security;
alter table player_external_ids enable row level security;
alter table stat_lines enable row level security;
alter table matchups enable row level security;
alter table lineup_entries enable row level security;
alter table transactions enable row level security;
alter table draft_picks enable row level security;
alter table record_definitions enable row level security;
alter table awards enable row level security;
alter table draft_pick_grades enable row level security;
alter table trade_grades enable row level security;
alter table data_gaps enable row level security;
alter table sync_runs enable row level security;

-- ---- Public read: powers the public history site (§8 of the spec) ----

create policy "public read leagues" on leagues
  for select using (true);

create policy "public read franchises" on franchises
  for select using (true);

create policy "public read seasons" on seasons
  for select using (true);

create policy "public read teams" on teams
  for select using (true);

create policy "public read matchups" on matchups
  for select using (true);

create policy "public read record_definitions" on record_definitions
  for select using (true);

create policy "public read awards" on awards
  for select using (true);

create policy "public read draft_picks" on draft_picks
  for select using (true);

create policy "public read draft_pick_grades" on draft_pick_grades
  for select using (true);

create policy "public read trade_grades" on trade_grades
  for select using (true);

create policy "public read stat_categories" on stat_categories
  for select using (true);

create policy "public read scoring_rules" on scoring_rules
  for select using (true);

create policy "public read roster_slots" on roster_slots
  for select using (true);

create policy "public read players" on players
  for select using (true);

create policy "public read lineup_entries" on lineup_entries
  for select using (true);

-- ---- Authenticated read only: internal/operational data ----

create policy "authenticated read player_external_ids" on player_external_ids
  for select using (auth.role() = 'authenticated');

create policy "authenticated read stat_lines" on stat_lines
  for select using (auth.role() = 'authenticated');

create policy "authenticated read transactions" on transactions
  for select using (auth.role() = 'authenticated');

create policy "authenticated read data_gaps" on data_gaps
  for select using (auth.role() = 'authenticated');

create policy "authenticated read sync_runs" on sync_runs
  for select using (auth.role() = 'authenticated');

-- No insert/update/delete policies exist yet anywhere. All writes go
-- through the service-role client (lib/supabase/service-role.ts),
-- which bypasses RLS. Commissioner write policies are added in
-- Phase 4.2 once auth roles exist.
