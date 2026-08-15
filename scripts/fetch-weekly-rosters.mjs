// One-off historical pull: weekly rosters/lineups for 2023-2025.
// Fetches ESPN's mBoxscore view per week (current-season-style endpoint,
// which — unlike leagueHistory — includes rosterForCurrentScoringPeriod
// even for past seasons), extracts a compact per-week roster snapshot,
// and discards the raw ~800KB/week payload after extraction.
//
// Not part of the app runtime — run manually with:
//   node scripts/fetch-weekly-rosters.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const LEAGUE_ID = "771894515";
const YEARS = [2023, 2024, 2025];
const WEEKS_PER_YEAR = 17; // 14 regular + 3 playoff, confirmed via status.finalScoringPeriod

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

function extractWeek(json, year, week) {
  const games = json.schedule.filter((g) => g.matchupPeriodId === week);
  const teamRosters = {};
  for (const game of games) {
    for (const side of ["home", "away"]) {
      const team = game[side];
      if (!team) continue;
      const rosterSlice = team.rosterForCurrentScoringPeriod;
      if (!rosterSlice) continue; // bye or missing data
      teamRosters[team.teamId] = rosterSlice.entries.map((e) => ({
        playerId: e.playerId,
        name: e.playerPoolEntry?.player?.fullName ?? null,
        proTeamId: e.playerPoolEntry?.player?.proTeamId ?? null,
        defaultPositionId: e.playerPoolEntry?.player?.defaultPositionId ?? null,
        lineupSlotId: e.lineupSlotId,
        weekPoints: e.playerPoolEntry?.appliedStatTotal ?? null,
      }));
    }
  }
  return { year, week, teamRosters };
}

async function run() {
  for (const year of YEARS) {
    const weeksOut = [];
    for (let week = 1; week <= WEEKS_PER_YEAR; week++) {
      process.stdout.write(`Fetching ${year} week ${week}... `);
      try {
        const json = await fetchWeekBoxscore(year, week);
        const extracted = extractWeek(json, year, week);
        const teamCount = Object.keys(extracted.teamRosters).length;
        weeksOut.push(extracted);
        console.log(`ok (${teamCount} teams with roster data)`);
      } catch (err) {
        console.log(`FAILED: ${err.message}`);
      }
      // Be polite to ESPN's API.
      await new Promise((r) => setTimeout(r, 150));
    }
    mkdirSync(join(ROOT, "data", "history"), { recursive: true });
    writeFileSync(
      join(ROOT, "data", "history", `rosters-${year}.json`),
      JSON.stringify(weeksOut, null, 2),
    );
    console.log(`Wrote data/history/rosters-${year}.json (${weeksOut.length} weeks)`);
  }
}

run();
