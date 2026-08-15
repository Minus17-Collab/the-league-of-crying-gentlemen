# ROADMAP.md

Phased build plan. Each task is scoped to be a single agent session.
Feed them one at a time — do not hand an agent an entire phase at once.

Read `AGENTS.md` before starting any task.

---

## Phase 0 — Foundation

**0.1 Project scaffold**
Next.js 15 App Router + TypeScript strict + Tailwind + Vitest + Playwright.
Supabase client setup (browser + server + service-role variants).
- Done when: `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint` all pass on an empty project.

**0.2 Database migrations**
Convert `schema.sql` into ordered Supabase migrations. Add RLS policies:
default deny; public read on `leagues`, `seasons`, `teams`, `franchises`,
`matchups`; authenticated read elsewhere; writes service-role only for now.
- Status: migration files written (`supabase/migrations/`), including
  manager-lifecycle fields on `franchises` and the grading tables from
  Phase 3.5. Not yet applied — no Supabase project exists yet to link.
- Done when: migrations apply cleanly to a fresh database and `pnpm db:types` emits valid types.

**0.3 Seed data**
Seed `stat_categories` with the standard NFL fantasy stat vocabulary
(passing, rushing, receiving, kicking, DST, IDP). Seed a default
`scoring_rules` set and `roster_slots` set for one season, values supplied
by the league owner — do not invent them.
- Done when: a seeded season has a complete, queryable scoring config.

---

## Phase 1 — Scoring engine

**1.1 Core engine**
Implement `lib/scoring/engine.ts`. Handles per-unit points, flat bonuses,
min/max thresholds, and position filters. Pure function, no I/O, no database
calls.
- Status: done. `src/lib/scoring/engine.ts` + `src/lib/scoring/engine.test.ts` (37 tests, all passing).
- Done when: 30+ unit tests cover per-unit scoring, threshold bonuses, position filters, negative points, and empty-input edge cases.

**1.2 Golden-file regression tests**
Fixture: real stat lines + real scoring rules + expected point totals.
This is the safety net for every future change.
- Done when: fixtures exist for at least 3 weeks of real data and pass.

---

## Phase 2 — ESPN sync (2026 mirror)

**2.1 Provider interface + ESPN adapter**
Implement `StatProvider` and the ESPN implementation. Handles private-league
cookie auth (`SWID`, `espn_s2`). Zod-validate all responses.
- Status: scaffolded (`src/lib/providers/`). Endpoint calls, cookie auth,
  zod schemas, and normalization are implemented but UNVERIFIED against a
  real ESPN response — `ESPN_STAT_ID_TO_KEY` in `espn/mappings.ts` is
  intentionally empty until cross-checked against this league's real
  `mSettings`. Requires `ESPN_SWID`/`ESPN_S2` to test.
- Done when: fetching a real league returns normalized players, rosters, matchups, and stat lines.

**2.2 Player identity resolution**
Map ESPN player IDs into `players` + `player_external_ids`. Handle name
collisions and mid-season team changes without creating duplicate players.
- Done when: syncing twice produces zero duplicate player rows.

**2.3 Sync jobs**
Vercel cron route handlers. Full sync (daily), live sync (every 5 min during
game windows). Every run writes a `sync_runs` row. Failures are logged and
retried, never silent.
- Status: skeleton route handler at `src/app/api/cron/sync/route.ts` +
  `vercel.json` cron schedule (Tuesdays). Checks ESPN credentials and logs
  to `sync_runs`; does not yet upsert gameplay data (depends on 2.2).
- Done when: a scheduled run populates a week of data end to end and is visible in `sync_runs`.

---

## Phase 3 — Public site

**3.1 League history**
Season list, final standings, champions, franchise pages with all-time record.
All cross-season queries join through `franchise_id`.
- Done when: every season in the database renders with correct standings.

**3.2 Record book**
Driven by `record_definitions`. Each definition maps to a registered SQL view.
Adding a record is an INSERT plus a view — no page changes.
- Done when: at least 8 records render, and a 9th can be added without touching TSX.

**3.3 Weekly scoreboard**
Matchup list per week, box scores, starters vs bench, points left on bench.
- Done when: scores match ESPN exactly for a completed week.

---

## Phase 3.5 — Derived stats & grading

Added per the Fantasy League HQ hybrid plan (see
`.windsurf/plans/fantasy-league-hq-hybrid-6c3632.md`). Depends on Phase 2's
full-history backfill being complete for every discovered season.

**3.5.1 Derived stats**
All-play record, expected wins/luck, median record, optimal-lineup
efficiency (assignment solver respecting each season's real roster_slots),
head-to-head matrix, career manager stats. Computed by a scheduled job
into SQL views or dedicated tables, never in a page request or in the
browser.
- Done when: all-play wins across the league sum to the mathematically
  required total each week; optimal lineup >= actual lineup for every
  manager-week; luck ratings sum to ~0 each season.

**3.5.2 Draft grading**
Draft Night Grade (curved, ADP-based reach value) computed at ingest time;
End-of-Season Regrade (uncurved, VOE against a pooled pick-slot decay
curve) computed once a season is `is_locked`. Both write to
`draft_pick_grades`.
- Done when: every pick has a reach value and, once the season is locked,
  a VOE and regrade grade; math is reproducible from `stat_lines` +
  `scoring_rules` + `draft_picks`.

**3.5.3 Trade grading**
Started-points and total-points valuation per side, from trade week
through end of regular season (or end of playoffs if traded during the
postseason). Writes to `trade_grades` with a verdict band. Future draft
picks in trades are excluded from valuation and logged to `data_gaps`.
- Done when: every trade has a verdict and a stated evaluation window.

---

## Phase 4 — Accounts

**4.1 Auth**
Supabase magic-link login. Claim flow linking a user to a franchise, approved
by the commissioner.
- Done when: a user can sign in, claim a franchise, and see their team highlighted.

**4.2 Roles + commissioner tools**
Role enforcement in RLS, not just UI. Commissioner can edit season settings,
scoring rules, and awards.
- Done when: a `member` cannot read or write another franchise's private data, verified by test.

---

## Phase 5 — Replace ESPN (2027)

Do not start Phase 5 until Phases 0–4 are running in production for a full
season. Each item below is a multi-session project.

- **5.1** Second stat provider (Sleeper or Tank01) behind the same interface, with a provider-parity test comparing both against a known week.
- **5.2** Roster management: add/drop, lineup setting, position eligibility validation, kickoff lock.
- **5.3** Waivers: rolling priority or FAAB, scheduled batch processing, tiebreaks.
- **5.4** Trades: proposal, counter, approval window, veto, commissioner override.
- **5.5** Live scoring: in-game polling, optimistic UI, reconciliation on stat corrections.
- **5.6** Draft room: real-time via Supabase Realtime, timer, autopick, queue, offline recovery.

**Highest-risk item is 5.6.** A draft that breaks is unrecoverable in the
moment. Build it with a manual-entry fallback path from day one.

---

## Open questions — answer before Phase 0.3

Most of these are now answered by the 2023-2025 historical pull — see
`data/history/SUMMARY.md` for full detail and sourcing. Remaining
open items are marked accordingly.

- ESPN league ID: `771894515` (confirmed). League "Association of Try Hard
  Gamers" is **publicly readable for the current (2026) season** via ESPN's
  API with no cookies; 2023-2025 required `ESPN_SWID`/`ESPN_S2` (obtained,
  see `RUNBOOK.md`).
- Scoring settings: confirmed for all of 2023, 2024, 2025 (2026 identical
  to 2024/2025). Full statId->points map and year-over-year diffs in
  `data/history/scoring-by-season.json` / `scoring-diffs.json`.
  **RESOLVED — statIds 198 and 209 stay unmapped.** Commissioner doesn't
  know what they are either; leaving them flagged/unmapped in
  `src/lib/providers/espn/mappings.ts` rather than guessing is the
  correct behavior per `AGENTS.md`, not a blocker.
- Roster configuration: confirmed via live `mSettings` — 1 QB, 2 RB, 2 WR,
  1 TE, 1 FLEX, 1 D/ST, 1 K, 8 BE, 1 IR (2026 settings; same shape
  2024-2025, see `data/history/format-by-season.json` for prior years).
- Number of seasons of history available: 4 (2023, 2024, 2025, 2026) per
  ESPN's `previousSeasons`.
- Playoff format: 2023 was 8 teams/6 playoff spots; 2024 onward is 10
  teams/8 playoff spots, 2 divisions ("Try Hards"/"Sweats"). 14 regular
  season weeks + 3 playoff weeks (weeks 15-17) every season.
- Keeper or dynasty rules: confirmed none — 0 keepers every season,
  redraft only. Draft type was SNAKE in 2023-2024 but **AUTOPICK in
  2025** — still needs a commissioner answer on whether that was
  intentional (see `data/history/SUMMARY.md` "Known gaps").
- Manager list: confirmed for 2023-2025 in `data/history/managers.json`.
  8 managers in 2023, growing to 10 from 2024 on. Jacob Grant left after
  2023; Leah Faison played only 2024.
- **RESOLVED — franchise identity rule (commissioner-confirmed):** when a
  new owner inherits an old ESPN `teamId` slot, it is **always a new
  `franchises` row**, never a continuation of the old one. ESPN's
  `teamId` is a recycled slot, not a stable identity, so this must be
  enforced at ingest time (Phase 2.2) rather than inferred from `teamId`
  continuity.
  - Confirmed happening again for **2026**: `data/espn-raw/2026/settings-teams.json`
    shows **Trent Cassell** (2025 `teamId` 10, "Street Rats") and
    **Bradly Major** (2025 `teamId` 5, "Fisted Sister") both absent from
    the 2026 `members` list — two open/unclaimed slots ("Team 5",
    "Team 10"), not one. Whoever claims those slots for 2026 gets new
    `franchises` rows, per the rule above.

## Infra setup (blocks Phase 0.2 apply / Phase 2 testing)

- Supabase account + project: not yet created. **Still blocking** —
  nothing in `data/history/` has been inserted into a database yet.
- GitHub repo: not yet created (local git repo exists, not yet pushed).
- `ESPN_SWID` / `ESPN_S2`: obtained and verified working 2026-08-15 for
  all 4 seasons (2023-2026). See `RUNBOOK.md` for refresh instructions —
  cookie export showed a short (~6 day) expiry window.
- Hosting: Vercel, free tier / default subdomain (per `.windsurf/plans/fantasy-league-hq-hybrid-6c3632.md`).

## Historical data pull (2023-2025)

Done as a one-time manual pull, not yet wired into the app or database.
Raw ESPN dumps in `data/espn-raw/`, normalized JSON in `data/history/`,
full findings in `data/history/SUMMARY.md`. Covers: scoring settings +
diffs, managers + inferred retirements, team records, full matchup
schedule with computed winners, weekly rosters for all 17 weeks x 3
seasons, and roster-count aggregation for all 329 unique players
rostered at least once. This is source material for Phase 0.3 seed
data and Phase 2 sync-job design — it does not replace either phase.
