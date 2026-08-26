// One-off pull of historical preseason ADP (Average Draft Position) from
// Fantasy Football Calculator's public REST API, to support Draft Night
// Grade in scripts/compute-draft-grades.mjs (see ROADMAP.md 3.5.2).
//
// This league scores 1 pt/reception every season (confirmed full PPR from
// data/history/scoring-by-season.json), so we always pull the "ppr" format.
//
// Known limitation (logged to `data_gaps` by compute-draft-grades.mjs, not
// here): this is public aggregated mock/real draft data from FFC's whole
// user base, not this specific league's own draft conditions, team count,
// or exact draft date. The `teams` query parameter does not appear to
// change FFC's returned ADP values (verified empirically: identical `adp`
// values returned for teams=8/10/12 for the same year) — ADP there is an
// overall draft-order rank, not team-count-relative — so we request the
// documented default (12) for clarity and don't rely on it changing
// anything.
//
// Run with:
//   node scripts/fetch-historical-adp.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const YEARS = [2023, 2024, 2025];

function log(...args) {
  console.log("[fetch-historical-adp]", ...args);
}

async function fetchAdp(year) {
  const url = `https://fantasyfootballcalculator.com/api/v1/adp/ppr?teams=12&year=${year}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${year}: HTTP ${res.status}`);
  }
  return res.json();
}

async function run() {
  mkdirSync(join(ROOT, "data/history"), { recursive: true });

  for (const year of YEARS) {
    log(`fetching ${year}...`);
    const json = await fetchAdp(year);
    const players = (json.players ?? []).map((p) => ({
      name: p.name,
      position: p.position,
      team: p.team,
      adp: p.adp,
      timesDrafted: p.times_drafted,
    }));

    const out = {
      year,
      source: "fantasyfootballcalculator.com/api/v1/adp/ppr",
      fetchedAt: new Date().toISOString(),
      meta: json.meta ?? null,
      players,
    };

    const outPath = join(ROOT, `data/history/adp-${year}.json`);
    writeFileSync(outPath, JSON.stringify(out, null, 2));
    log(year, "players:", players.length, "->", outPath);

    await new Promise((r) => setTimeout(r, 200));
  }

  log("done");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
