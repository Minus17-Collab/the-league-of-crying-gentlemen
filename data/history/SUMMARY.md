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

## Known gaps / unverified

- **statId `198` and `209`** appear in this league's scoring config but aren't documented in any public ESPN stat-ID reference I could find. Left unmapped rather than guessed — flagged for commissioner input or discovery once real stat lines are synced and can be matched empirically.
- Weekly roster `weekPoints` (`appliedStatTotal`) was pulled as ESPN's own applied total, **not recomputed** via our `computePoints()` engine — do not treat it as validated against our scoring engine yet. That validation is Phase 1.2 (golden-file regression tests).
- No draft-pick-level data (who drafted whom, in what round) was pulled in this batch — that's a separate `mDraftDetail` view, not yet fetched.
