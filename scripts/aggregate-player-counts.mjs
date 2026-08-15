// One-off: aggregate unique rostered players (2023-2025) with roster-week
// counts, split by season and combined. Only includes players who appeared
// on at least one roster (per the request — skip anyone never rostered).
//
// Not part of the app runtime — run manually with:
//   node scripts/aggregate-player-counts.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const YEARS = [2023, 2024, 2025];

const playerTotals = new Map(); // playerId -> { name, seasons: { [year]: weekCount } }

for (const year of YEARS) {
  const weeks = JSON.parse(
    readFileSync(join(ROOT, "data", "history", `rosters-${year}.json`), "utf-8"),
  );
  for (const weekEntry of weeks) {
    for (const teamId of Object.keys(weekEntry.teamRosters)) {
      for (const p of weekEntry.teamRosters[teamId]) {
        if (!p.playerId || p.playerId < 0) continue; // skip empty slots
        if (!playerTotals.has(p.playerId)) {
          playerTotals.set(p.playerId, { name: p.name, seasons: {} });
        }
        const rec = playerTotals.get(p.playerId);
        rec.seasons[year] = (rec.seasons[year] ?? 0) + 1;
      }
    }
  }
}

const players = [...playerTotals.entries()]
  .map(([playerId, rec]) => {
    const totalWeeksRostered = Object.values(rec.seasons).reduce(
      (a, b) => a + b,
      0,
    );
    return {
      playerId,
      name: rec.name,
      seasonsRostered: Object.keys(rec.seasons).map(Number).sort(),
      weeksRosteredBySeason: rec.seasons,
      totalWeeksRostered,
    };
  })
  .sort((a, b) => b.totalWeeksRostered - a.totalWeeksRostered);

writeFileSync(
  join(ROOT, "data", "history", "player-roster-counts.json"),
  JSON.stringify(players, null, 2),
);

console.log(`Unique players rostered at least once (2023-2025): ${players.length}`);
console.log("Top 10 by total weeks rostered:");
for (const p of players.slice(0, 10)) {
  console.log(`  ${p.name} (id ${p.playerId}): ${p.totalWeeksRostered} weeks`);
}
