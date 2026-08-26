// One-off historical pull: archives the raw ESPN `mMatchupScore` view
// (which includes `playoffTierType` and `winner` per game — absent from
// the earlier settings-teams.json dump used by analyze-espn-history.mjs)
// for each historical season, verbatim, under data/espn-raw/{year}/.
//
// Run with:
//   node --env-file=.env.local scripts/fetch-playoff-tiers.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const YEARS = [2023, 2024, 2025];

const leagueId = process.env.ESPN_LEAGUE_ID;
const swid = process.env.ESPN_SWID;
const espnS2 = process.env.ESPN_S2;
if (!leagueId || !swid || !espnS2) {
  throw new Error("ESPN_LEAGUE_ID / ESPN_SWID / ESPN_S2 must be set (see .env.local).");
}

for (const year of YEARS) {
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/leagueHistory/${leagueId}?seasonId=${year}&view=mMatchupScore`;
  const res = await fetch(url, { headers: { Cookie: `SWID=${swid}; espn_s2=${espnS2}` } });
  if (!res.ok) {
    throw new Error(`ESPN fetch failed for ${year}: ${res.status}`);
  }
  const raw = await res.json();
  const dir = join(ROOT, "data", "espn-raw", String(year));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "matchup-score.json"), JSON.stringify(raw, null, 2));
  console.log(`${year}: archived matchup-score.json`);
}
