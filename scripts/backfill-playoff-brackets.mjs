// One-off: re-populates just the `matchups` table's new `playoff_bracket`
// (and corrected `is_championship`) columns for the existing 2023-2025
// seasons, from the regenerated data/history/matchups-by-season.json
// (see scripts/analyze-espn-history.mjs). Narrower than re-running the
// full scripts/backfill-supabase.mjs — doesn't touch any other table.
//
// Run with:
//   node --env-file=.env.local scripts/backfill-playoff-brackets.mjs

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function loadJson(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), "utf-8"));
}

const matchupsBySeason = loadJson("data/history/matchups-by-season.json");

async function run(year) {
  const { data: season, error: seasonErr } = await supabase
    .from("seasons")
    .select("id")
    .eq("year", year)
    .maybeSingle();
  if (seasonErr) throw seasonErr;
  if (!season) {
    console.warn(`no season row for ${year}, skipping`);
    return;
  }

  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .select("id, espn_team_id")
    .eq("season_id", season.id);
  if (teamsErr) throw teamsErr;
  const teamMap = new Map(teams.map((t) => [t.espn_team_id, t.id]));

  const matchups = matchupsBySeason[String(year)] ?? [];
  await supabase.from("matchups").delete().eq("season_id", season.id);

  const rows = [];
  for (const m of matchups) {
    if (m.awayTeamId === null) continue; // bye week; not a real matchup
    const homeId = teamMap.get(String(m.homeTeamId));
    const awayId = teamMap.get(String(m.awayTeamId));
    if (!homeId || !awayId) {
      console.warn("matchup team not found", year, m.homeTeamId, m.awayTeamId);
      continue;
    }
    rows.push({
      season_id: season.id,
      week: m.week,
      home_team_id: homeId,
      away_team_id: awayId,
      home_score: m.homeScore,
      away_score: m.awayScore,
      is_playoff: m.isPlayoff,
      is_championship: m.isChampionship ?? false,
      is_final: m.winner !== null,
      playoff_bracket: m.playoffBracket ?? null,
    });
  }

  const { error } = await supabase.from("matchups").insert(rows);
  if (error) throw error;
  console.log(`${year}: reinserted ${rows.length} matchups`);
}

for (const year of [2023, 2024, 2025]) {
  await run(year);
}
