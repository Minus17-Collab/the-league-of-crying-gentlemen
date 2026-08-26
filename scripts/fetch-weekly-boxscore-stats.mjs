// Historical pull: per-player, per-statId boxscore lines for 2023-2025.
// Unlike scripts/fetch-weekly-rosters.mjs (which only cached ESPN's own
// `appliedStatTotal`), this fetches the full stats breakdown per player so
// lib/scoring/engine.ts can independently recompute points from
// scoring_rules and be checked against ESPN's own total (Phase 1.2 golden
// files) rather than trusting ESPN's total blindly.
//
// Not part of the app runtime — run manually with:
//   node --env-file=.env.local scripts/fetch-weekly-boxscore-stats.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const LEAGUE_ID = "771894515";
const YEARS = [2023, 2024, 2025];
const WEEKS_PER_YEAR = 17;

const SWID = process.env.ESPN_SWID;
const S2 = process.env.ESPN_S2;
if (!SWID || !S2) {
  console.error("ESPN_SWID / ESPN_S2 must be set in the environment.");
  process.exit(1);
}

const headers = { Cookie: `SWID=${SWID}; espn_s2=${S2}` };

async function fetchWeekBoxscore(year, week) {
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${LEAGUE_ID}?view=mBoxscore&scoringPeriodId=${week}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`${year} week ${week}: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Extracts, per player who appeared in a roster this week, the raw
 * statId -> value map for the ACTUAL result of that scoring period
 * (statSourceId === 0, scoringPeriodId === week). Skips players with no
 * matching stats entry (bye-adjacent edge cases, missing data).
 */
function extractWeekStats(json, week) {
  const games = json.schedule.filter((g) => g.matchupPeriodId === week);
  const players = [];
  const seen = new Set();

  for (const game of games) {
    for (const side of ["home", "away"]) {
      const team = game[side];
      if (!team) continue;
      const rosterSlice = team.rosterForCurrentScoringPeriod;
      if (!rosterSlice) continue;
      for (const entry of rosterSlice.entries) {
        const playerId = entry.playerId;
        if (seen.has(playerId)) continue;
        seen.add(playerId);
        const player = entry.playerPoolEntry?.player;
        if (!player) continue;
        const weekStats = (player.stats ?? []).find(
          (s) => s.scoringPeriodId === week && s.statSourceId === 0,
        );
        if (!weekStats) continue;
        players.push({
          playerId,
          name: player.fullName ?? null,
          stats: weekStats.stats,
        });
      }
    }
  }
  return players;
}

async function run() {
  for (const year of YEARS) {
    const weeksOut = [];
    for (let week = 1; week <= WEEKS_PER_YEAR; week++) {
      process.stdout.write(`Fetching ${year} week ${week} boxscore stats... `);
      try {
        const json = await fetchWeekBoxscore(year, week);
        const players = extractWeekStats(json, week);
        weeksOut.push({ year, week, players });
        console.log(`ok (${players.length} players with stats)`);
      } catch (err) {
        console.log(`FAILED: ${err.message}`);
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    mkdirSync(join(ROOT, "data", "history"), { recursive: true });
    writeFileSync(
      join(ROOT, "data", "history", `boxscore-stats-${year}.json`),
      JSON.stringify(weeksOut, null, 2),
    );
    console.log(`Wrote data/history/boxscore-stats-${year}.json (${weeksOut.length} weeks)`);
  }
}

run();
