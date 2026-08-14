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
- Done when: fetching a real league returns normalized players, rosters, matchups, and stat lines.

**2.2 Player identity resolution**
Map ESPN player IDs into `players` + `player_external_ids`. Handle name
collisions and mid-season team changes without creating duplicate players.
- Done when: syncing twice produces zero duplicate player rows.

**2.3 Sync jobs**
Vercel cron route handlers. Full sync (daily), live sync (every 5 min during
game windows). Every run writes a `sync_runs` row. Failures are logged and
retried, never silent.
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

- ESPN league ID, and whether the league is public or private
- Exact scoring settings (export from ESPN league settings page)
- Roster configuration: starting slots, bench size, IR slots
- Number of seasons of history available on ESPN
- Playoff format: teams, weeks, byes, seeding rules
- Keeper or dynasty rules, if any
