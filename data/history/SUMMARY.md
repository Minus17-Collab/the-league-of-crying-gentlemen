# League History Pull — 2023-2025

Pulled 2026-08-15 from ESPN's public/authenticated API for league `771894515`
("Association of Try Hard Gamers"). See `RUNBOOK.md` for how these
credentials were obtained. Raw source dumps live in `data/espn-raw/`;
normalized/derived files live alongside this summary in `data/history/`.

**This is a one-time manual pull for record-keeping and to inform schema
design — it has not been inserted into any database (none exists yet).**
Treat it as source material for Phase 0.3 seed data and Phase 2 sync-job
design, not as a live data source.

## Files in this directory

| File | Contents |
|---|---|
| `managers.json` | Every ESPN owner GUID seen 2023-2025, name, seasons active, inferred retirement year |
| `teams-by-season.json` | Each team per season: name, owner, final record, points for/against, playoff seed, final rank |
| `matchups-by-season.json` | Every matchup (regular + playoff) per season with scores and computed winner |
| `scoring-by-season.json` | Full scoring rule set (statId -> points/overrides) per season |
| `scoring-diffs.json` | Diffed scoring rules 2023->2024 and 2024->2025 |
| `format-by-season.json` | Team count, divisions, playoff format, draft type per season |
| `rosters-2023.json` / `-2024.json` / `-2025.json` | Every team's roster (starters + bench) for all 17 weeks (14 regular + 3 playoff) each season |
| `player-roster-counts.json` | Every player (329 total) rostered at least once 2023-2025, with weeks-rostered counts per season |

## Key findings

### Manager / franchise history

- **8 managers** in 2023, growing to **10** from 2024 onward.
- **Jacob Grant** left after 2023 (team slot 5 taken over by **Bradly Major** in 2024, new team "Fisted Sister").
- **Leah Faison** played only 2024 (team slot 11, "Krabby Patty"); that slot was taken over by **Josh Wiles** in 2025 ("Shake and Bake").
- Everyone else (Zack Gallman, Bryan Morgan, Trevon Benjamin, Brent Morgan, Lucas Grant, Marcus Faison, Kendall Arnold, Trent Cassell) has played every season since joining.
- **Important schema note:** ESPN's `teamId` is a recycled slot, not a stable franchise identity — when an owner leaves, a new owner can inherit their `teamId` with a new team name. Our `franchises` table should key off owner identity (and commissioner-confirmed continuity), not `teamId`, exactly as `AGENTS.md`'s franchises-vs-teams invariant already assumes. Confirm with commissioner whether "team inherited a slot" should ever count as the same franchise, or always as a new one — I did not assume either way.

### Scoring rule changes

- **2024 → 2025: zero changes.** Current settings match 2024 and 2025 exactly (confirmed against the live 2026 pull earlier too).
- **2023 → 2024: 37 stat rules changed**, most notably:
  - Passing yards: 0.07 pts/yd → 0.04 pts/yd (1pt/25yd, more standard)
  - Passing TD: 3 → 4 points
  - Rushing/Receiving TD bonuses restructured — 2023 used **draft-position-based point overrides** (`pointsOverrides` keyed by roster slot 1-4, 15) for rushing/receiving yards and TDs; 2024 flattened these to single flat values (6 pts rush TD, 0.1 pts/rush yd, etc.) — i.e. 2023 scored positions differently by *lineup slot*, 2024 did not.
  - Several 2023-only bonus categories removed for 2024: 40+/50+ yard passing TD bonus, 300/400-yard passing game bonus, similar rushing bonuses (40+/50+/100-199/200+ yard game), receiving 40+/50+ yard TD bonus, targets, times-sacked penalty, missed extra points penalty.
  - FG scoring increased: 40-49 yd FG 1→4 pts, under-40 FG 0.5→3 pts, extra point 0.5→1 pt.
  - Defensive points/yards-allowed bands got harsher (e.g. 450-499 yds allowed: -3 → -5).
- Full detail in `scoring-diffs.json`.

### League format changes

- 2023: 8 teams, 2 divisions ("Try Hards" / "Sweats", 4 each), 6 playoff spots.
- 2024 onward: 10 teams, 2 divisions ("Try Hards" / "Sweats", 5 each), 8 playoff spots.
- Draft type: **SNAKE** in 2023 and 2024, but **AUTOPICK** in 2025 — worth asking the commissioner whether that was intentional (e.g. a manager missed the live draft) or the whole league auto-drafted. All 3 seasons: 0 keepers (confirms redraft-only).

### Head-to-head / matchups

Full schedule with computed winners for all 3 seasons in `matchups-by-season.json`. Weeks 1-14 are regular season, 15-17 are playoffs (`isPlayoff: true`) in every season.

### Weekly rosters & player counts

- Weekly starter/bench roster snapshots pulled for all 17 weeks in each of the 3 seasons (51 team-weeks total per team across the pull).
- **329 unique players** were rostered at least once from 2023-2025 (players never rostered are excluded, per request).
- Most-rostered players (51/51 weeks — every week of every season): Chris Olave, DeVonta Smith, Alvin Kamara, James Cook, Ja'Marr Chase, Josh Jacobs, Josh Allen, Breece Hall, Justin Jefferson, Amon-Ra St. Brown.

## Resolved (commissioner-confirmed)

- **Franchise identity across owner changes**: a new owner inheriting an old ESPN `teamId` slot is **always a new `franchises` row**, never a continuation. Confirmed happening again for 2026 — Trent Cassell (2025 `teamId` 10) and Bradly Major (2025 `teamId` 5) are both absent from the 2026 `members` list (see `data/espn-raw/2026/settings-teams.json`); two open/unclaimed slots, not one.

### Draft picks

Pulled via `scripts/fetch-draft-and-transactions.mjs` → `draft-picks-by-season.json`: 136 picks in 2023 (8 teams x 17 rounds), 170 in 2024 and 2025 (10 teams x 17 rounds). Each pick has `teamId` + `playerId` + round/overall position, but **not player names** — resolving `playerId` to a name requires a separate player-info call, deferred to Phase 2.2 (player identity resolution) rather than done ad hoc here.

### Boxscore stat lines (2026-08-16 update)

Pulled via `scripts/fetch-weekly-boxscore-stats.mjs` → `boxscore-stats-{year}.json`: full per-player, per-statId boxscore breakdowns for all 51 weeks (2023-2025), not just ESPN's cached `weekPoints` total. Loaded into Supabase `stat_lines` by `scripts/backfill-supabase.mjs` and validated by `scripts/validate-scoring.mjs`, which independently recomputes every `lineup_entries.points` value via `lib/scoring/engine.ts` (`computePoints`) from `stat_lines` + `scoring_rules` and diffs it against ESPN's own cached total:

- **2024: 2488/2488 matched (100%).** **2025: 2506/2506 matched (100%).** The scoring engine, stat-ID mappings, and scoring_rules ingestion are confirmed byte-exact against ESPN's own numbers for both seasons.
- **2023: 1174/2043 matched (~57%).** All mismatches are running backs, and all stem from the one still-open gap below (2023 position-keyed rush-yardage overrides) — not a new issue.

### Previously-unmapped statIds — now resolved (2026-08-16)

`198`, `209`, and `214` (previously left unmapped, commissioner didn't recognize them either) were identified by cross-referencing `cwendt94/espn-api`'s `SETTINGS_SCORING_FORMAT_MAP`, which documents labels for statIds up to 234 (broader than the `PLAYER_STATS_MAP` subset checked originally):

- `198` = "FG Made (50-59 yards)" — a real distance band between `fg_40_49` (77) and `fg_60_plus` (201) that this league's original mapping had a gap for.
- `209` = "1pt Safety" (a rare NFL rule: returning a blocked-kick/failed-2pt-attempt for a safety).
- `214` = "FG Made Yards" — a per-yard bonus on made field goals (2023 only, 0.01 pts/yard).

All other previously-unmapped statIds in this league's real scoring config (`15`-`18`, `35`-`38`, `45`, `46`, `56`-`58`, `64`, `83`, `88`, `109`, `114`, `115`) were also identified via the same reference and are now mapped in `src/lib/providers/espn/mappings.ts` — see that file's header comment for the full list and provenance.

## Known gaps / unverified

- **2023 rush-yardage/TD scoring overrides are NOT fully modeled.** statIds `24` (rush_yd), `25` (rush_td), `26` (rush_2pt), `35`-`38` (rush TD/yardage-game bonuses) carry `pointsOverrides` keyed by small integers (`"1"`, `"2"`, `"3"`, `"4"`, `"15"`) that do not match ESPN's `defaultPositionId` or `lineupSlotId` vocabularies used elsewhere in this codebase, and could not be confirmed from public references. Current ingestion falls back to the base `points` value (0 for all seven in 2023), which **undercounts every running back's 2023 score** — confirmed via `validate-scoring.mjs` (869 mismatches, 100% of them RBs, e.g. Christian McCaffrey week 1 2023: ESPN shows 38.25, engine computes 4.95). This needs commissioner input: which position/roster-slot does each override key (1, 2, 3, 4, 15) represent? Once known, `resolveStatPoints()` in `scripts/backfill-supabase.mjs` and the header comment in `src/lib/providers/espn/mappings.ts` can be updated to apply per-position scoring for 2023.
- **Transactions could not be pulled — re-confirmed 2026-08-16.** Tried `view=mTransactions2` with the exact `x-fantasy-filter` header the reference `cwendt94/espn-api` implementation uses (still returns no `transactions` key, for all of 2023-2026), and the `communication/?view=kona_league_communication` "recent activity" endpoint (returns HTTP 404 for 2023-2025 — ESPN does not retain that feed for past seasons — and HTTP 200 with zero topics for the live 2026 season). This is conclusively an ESPN data-retention limitation for this league, not a header/parameter issue. `transactions-by-season.json` remains `[]` for every season; there is no further avenue to pursue with ESPN's public API.
- **Roster slot counts are pulled from the authoritative `mSettings` response** (`settings.rosterSettings.lineupSlotCounts` in `data/espn-raw/{year}/settings-teams.json`), not inferred from roster snapshots — confirmed identical across all 3 seasons (QB:1, RB:2, WR:2, TE:1, FLEX:1, K:1, DST:1, BE:8, IR:1).
