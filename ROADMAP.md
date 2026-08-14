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

- ESPN league ID: `771894515` (confirmed). League is currently private —
  will be flipped to public once the site is filled out.
- Exact scoring settings (export from ESPN league settings page, or pull
  via `mSettings` once `ESPN_SWID`/`ESPN_S2` are provided)
- Roster configuration: starting slots, bench size, IR slots
- Number of seasons of history available on ESPN
- Playoff format: teams, weeks, byes, seeding rules
- Keeper or dynasty rules: none confirmed (redraft only, snake draft only)
- Manager list: names, active/retired status, OG-founder flags, and any
  ESPN account changes (rejoin under a new GUID)

## Infra setup (blocks Phase 0.2 apply / Phase 2 testing)

- Supabase account + project: not yet created.
- GitHub repo: not yet created (local git repo exists, not yet pushed).
- `ESPN_SWID` / `ESPN_S2`: not yet provided (needed to test the Phase 2.1 ESPN adapter against real data).
- Hosting: Vercel, free tier / default subdomain (per `.windsurf/plans/fantasy-league-hq-hybrid-6c3632.md`).
