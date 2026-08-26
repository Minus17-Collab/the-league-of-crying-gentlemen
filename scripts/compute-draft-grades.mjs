// Computes `draft_pick_grades` for every locked season (see AGENTS.md
// "Seasons are immutable once locked" and ROADMAP.md 3.5.2 "Draft
// grading"). Two independent gradings, both explained in detail in
// src/lib/grading/draftGrades.ts's header comment — THIS FILE MIRRORS
// THAT MODULE'S LOGIC IN PLAIN JS (same pattern as ESPN_STAT_ID_TO_KEY in
// backfill-supabase.mjs, duplicated because this one-off script runs
// without a TypeScript toolchain). Keep the two in sync.
//
//   1. End-of-season Regrade (VOE): pooled pick-slot decay curve built
//      purely from this league's own draft_picks + lineup_entries.points,
//      no external data.
//   2. Draft Night Grade (curved, ADP-based): needs
//      data/history/adp-{year}.json (see scripts/fetch-historical-adp.mjs).
//      Inherently approximate — see the data_gaps row this script writes.
//
// Run with:
//   node --env-file=.env.local scripts/fetch-historical-adp.mjs   (once)
//   node --env-file=.env.local scripts/compute-draft-grades.mjs

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function log(...args) {
  console.log("[compute-draft-grades]", ...args);
}
function warn(...args) {
  console.warn("[compute-draft-grades warn]", ...args);
}
function loadJson(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), "utf-8"));
}

// ---- mirrors src/lib/grading/draftGrades.ts — keep in sync ----

const REGRADE_BANDS = [
  { min: 60, grade: "A+" },
  { min: 40, grade: "A" },
  { min: 25, grade: "A-" },
  { min: 15, grade: "B+" },
  { min: 5, grade: "B" },
  { min: -5, grade: "B-" },
  { min: -15, grade: "C+" },
  { min: -25, grade: "C" },
  { min: -40, grade: "C-" },
  { min: -60, grade: "D" },
  { min: Number.NEGATIVE_INFINITY, grade: "F" },
];

const DRAFT_NIGHT_PERCENTILE_BANDS = [
  { min: 0.95, grade: "A+" },
  { min: 0.85, grade: "A" },
  { min: 0.75, grade: "A-" },
  { min: 0.6, grade: "B+" },
  { min: 0.45, grade: "B" },
  { min: 0.3, grade: "B-" },
  { min: 0.2, grade: "C+" },
  { min: 0.1, grade: "C" },
  { min: 0.05, grade: "C-" },
  { min: 0.02, grade: "D" },
  { min: Number.NEGATIVE_INFINITY, grade: "F" },
];

function bandFor(value, bands) {
  for (const band of bands) {
    if (value >= band.min) return band.grade;
  }
  return bands[bands.length - 1].grade;
}

function poolAdjacentViolatorsNonIncreasing(entries) {
  const blocks = entries.map((e) => ({
    value: e.value,
    weight: Math.max(e.weight, 0.0001),
    count: 1,
  }));
  let i = 0;
  while (i < blocks.length - 1) {
    if (blocks[i].value < blocks[i + 1].value) {
      const a = blocks[i];
      const b = blocks[i + 1];
      const mergedWeight = a.weight + b.weight;
      const merged = {
        value: (a.value * a.weight + b.value * b.weight) / mergedWeight,
        weight: mergedWeight,
        count: a.count + b.count,
      };
      blocks.splice(i, 2, merged);
      i = Math.max(i - 1, 0);
    } else {
      i += 1;
    }
  }
  const flat = [];
  for (const block of blocks) {
    for (let k = 0; k < block.count; k += 1) flat.push(block.value);
  }
  return flat;
}

function computeExpectedPointsByRound(picks) {
  const rounds = [...new Set(picks.map((p) => p.round))].sort((a, b) => a - b);
  const byRound = new Map();
  for (const pick of picks) {
    if (pick.seasonPoints == null) continue;
    const bucket = byRound.get(pick.round) ?? { total: 0, count: 0 };
    bucket.total += pick.seasonPoints;
    bucket.count += 1;
    byRound.set(pick.round, bucket);
  }
  const averages = rounds.map((round) => {
    const bucket = byRound.get(round);
    return { round, value: bucket ? bucket.total / bucket.count : 0, weight: bucket?.count ?? 0 };
  });
  const smoothed = poolAdjacentViolatorsNonIncreasing(averages);
  const result = new Map();
  smoothed.forEach((value, idx) => result.set(averages[idx].round, value));
  return result;
}

function computeRegrade(picks) {
  const expectedByRound = computeExpectedPointsByRound(picks);
  const withVoe = picks.map((pick) => {
    const expectedPoints = expectedByRound.get(pick.round) ?? null;
    const voe =
      pick.seasonPoints != null && expectedPoints != null
        ? pick.seasonPoints - expectedPoints
        : null;
    return { pick, expectedPoints, voe };
  });

  const rankBySeason = new Map();
  for (const entry of withVoe) {
    if (entry.voe == null) continue;
    const list = rankBySeason.get(entry.pick.seasonId) ?? [];
    list.push({ draftPickId: entry.pick.draftPickId, voe: entry.voe });
    rankBySeason.set(entry.pick.seasonId, list);
  }
  const rankByPickId = new Map();
  for (const list of rankBySeason.values()) {
    list.sort((a, b) => b.voe - a.voe);
    list.forEach((entry, idx) => rankByPickId.set(entry.draftPickId, idx + 1));
  }

  return withVoe.map(({ pick, expectedPoints, voe }) => ({
    draftPickId: pick.draftPickId,
    expectedPoints,
    voe,
    regradeGrade: voe != null ? bandFor(voe, REGRADE_BANDS) : null,
    regradeRank: rankByPickId.get(pick.draftPickId) ?? null,
  }));
}

function percentileRank(sorted, value) {
  if (sorted.length <= 1) return 0.5;
  let below = 0;
  let equal = 0;
  for (const v of sorted) {
    if (v < value) below += 1;
    else if (v === value) equal += 1;
  }
  return (below + equal / 2) / sorted.length;
}

function computeDraftNightGrade(picks) {
  const withReach = picks.map((pick) => ({
    pick,
    reachValue: pick.adpAtPick != null ? pick.overallPick - pick.adpAtPick : null,
  }));
  const bySeasonSorted = new Map();
  for (const entry of withReach) {
    if (entry.reachValue == null) continue;
    const list = bySeasonSorted.get(entry.pick.seasonId) ?? [];
    list.push(entry.reachValue);
    bySeasonSorted.set(entry.pick.seasonId, list);
  }
  for (const list of bySeasonSorted.values()) list.sort((a, b) => a - b);

  return withReach.map(({ pick, reachValue }) => {
    if (reachValue == null) {
      return { draftPickId: pick.draftPickId, reachValue: null, draftNightGrade: null };
    }
    const sorted = bySeasonSorted.get(pick.seasonId) ?? [reachValue];
    const percentile = percentileRank(sorted, reachValue);
    return {
      draftPickId: pick.draftPickId,
      reachValue,
      draftNightGrade: bandFor(percentile, DRAFT_NIGHT_PERCENTILE_BANDS),
    };
  });
}

// ---- name matching (this script only — not part of draftGrades.ts) ----

// Mascot each of our `players` rows uses for D/ST (see backfill-supabase.mjs
// ESPN_POSITION_MAP: position 16 -> "DST", full_name = "<Mascot> D/ST"),
// keyed by FFC's "team" abbreviation for its "<City> Defense" DEF rows.
const MASCOT_BY_TEAM_ABBR = {
  ARI: "Cardinals", ATL: "Falcons", BAL: "Ravens", BUF: "Bills",
  CAR: "Panthers", CHI: "Bears", CIN: "Bengals", CLE: "Browns",
  DAL: "Cowboys", DEN: "Broncos", DET: "Lions", GB: "Packers",
  HOU: "Texans", IND: "Colts", JAX: "Jaguars", KC: "Chiefs",
  LAC: "Chargers", LAR: "Rams", LV: "Raiders", MIA: "Dolphins",
  MIN: "Vikings", NE: "Patriots", NO: "Saints", NYG: "Giants",
  NYJ: "Jets", PHI: "Eagles", PIT: "Steelers", SEA: "Seahawks",
  SF: "49ers", TB: "Buccaneers", TEN: "Titans", WAS: "Commanders",
};

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[.']/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Builds a normalized-name -> our internal player lookup, including a
 * D/ST entry per FFC team abbreviation (see MASCOT_BY_TEAM_ABBR). */
function buildPlayerLookup(players) {
  const byName = new Map();
  for (const p of players) {
    if (p.position === "DST") continue;
    byName.set(normalizeName(p.full_name), p);
  }
  const dstByMascot = new Map();
  for (const p of players) {
    if (p.position !== "DST") continue;
    // full_name is "<Mascot> D/ST"
    const mascot = p.full_name.replace(/\s*D\/ST$/i, "").trim();
    dstByMascot.set(mascot, p);
  }
  return { byName, dstByMascot };
}

function matchAdpPlayer(adpPlayer, lookup) {
  if (adpPlayer.position === "DEF") {
    const mascot = MASCOT_BY_TEAM_ABBR[adpPlayer.team];
    if (!mascot) return null;
    return lookup.dstByMascot.get(mascot) ?? null;
  }
  return lookup.byName.get(normalizeName(adpPlayer.name)) ?? null;
}

// ---- main ----

async function fetchAllRows(query) {
  const rows = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function main() {
  log("loading locked seasons, draft picks, players, lineup entries...");

  const { data: seasons, error: seasonsErr } = await supabase
    .from("seasons")
    .select("id, year, is_locked")
    .eq("is_locked", true);
  if (seasonsErr) throw seasonsErr;
  if (!seasons || seasons.length === 0) {
    log("no locked seasons found — nothing to grade.");
    return;
  }
  const seasonIds = seasons.map((s) => s.id);
  const yearBySeasonId = new Map(seasons.map((s) => [s.id, s.year]));

  const { data: picks, error: picksErr } = await supabase
    .from("draft_picks")
    .select("id, season_id, round, overall_pick, team_id, player_id")
    .in("season_id", seasonIds);
  if (picksErr) throw picksErr;

  const { data: players, error: playersErr } = await supabase
    .from("players")
    .select("id, full_name, position");
  if (playersErr) throw playersErr;
  const playerById = new Map(players.map((p) => [p.id, p]));

  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .select("id, season_id")
    .in("season_id", seasonIds);
  if (teamsErr) throw teamsErr;
  const seasonIdByTeamId = new Map(teams.map((t) => [t.id, t.season_id]));

  const lineupEntries = await fetchAllRows(
    supabase
      .from("lineup_entries")
      .select("player_id, team_id, points")
      .in("team_id", teams.map((t) => t.id)),
  );

  // season_points per (player_id, season_id)
  const seasonPointsByPlayerSeason = new Map();
  for (const entry of lineupEntries) {
    if (entry.points == null) continue;
    const seasonId = seasonIdByTeamId.get(entry.team_id);
    if (!seasonId) continue;
    const key = `${entry.player_id}|${seasonId}`;
    seasonPointsByPlayerSeason.set(
      key,
      (seasonPointsByPlayerSeason.get(key) ?? 0) + entry.points,
    );
  }

  // ADP lookup per year
  const adpLookupByYear = new Map();
  for (const season of seasons) {
    try {
      const adpData = loadJson(`data/history/adp-${season.year}.json`);
      const playerLookup = buildPlayerLookup(players);
      const adpByInternalPlayerId = new Map();
      let unmatched = 0;
      for (const adpPlayer of adpData.players) {
        const matched = matchAdpPlayer(adpPlayer, playerLookup);
        if (matched) {
          // Keep the lowest (best/earliest) ADP if a name collides more
          // than once — shouldn't happen given the position check, but
          // never silently overwrite with a worse match.
          const existing = adpByInternalPlayerId.get(matched.id);
          if (existing == null || adpPlayer.adp < existing) {
            adpByInternalPlayerId.set(matched.id, adpPlayer.adp);
          }
        } else {
          unmatched += 1;
        }
      }
      adpLookupByYear.set(season.year, adpByInternalPlayerId);
      log(season.year, "ADP matched", adpByInternalPlayerId.size, "of", adpData.players.length, `(${unmatched} unmatched)`);
    } catch (err) {
      warn(season.year, "no ADP file found — run fetch-historical-adp.mjs first. Skipping Draft Night Grade for this year.", err.message);
      adpLookupByYear.set(season.year, new Map());
    }
  }

  // Build gradable picks
  let unmatchedDraftedPlayers = 0;
  let picksWithNoAdp = 0;
  const gradablePicks = picks.map((pick) => {
    const seasonId = pick.season_id;
    const year = yearBySeasonId.get(seasonId);
    const seasonPoints = pick.player_id
      ? seasonPointsByPlayerSeason.get(`${pick.player_id}|${seasonId}`) ?? null
      : null;
    const adpMap = adpLookupByYear.get(year) ?? new Map();
    const adpAtPick = pick.player_id ? adpMap.get(pick.player_id) ?? null : null;
    if (pick.player_id && !playerById.has(pick.player_id)) unmatchedDraftedPlayers += 1;
    if (pick.player_id && adpAtPick == null) picksWithNoAdp += 1;
    return {
      draftPickId: pick.id,
      seasonId,
      round: pick.round,
      overallPick: pick.overall_pick,
      seasonPoints,
      adpAtPick,
    };
  });

  log("computing regrade + draft night grade for", gradablePicks.length, "picks...");
  const regrades = computeRegrade(gradablePicks);
  const draftNights = computeDraftNightGrade(gradablePicks);
  const regradeByPickId = new Map(regrades.map((r) => [r.draftPickId, r]));
  const draftNightByPickId = new Map(draftNights.map((r) => [r.draftPickId, r]));

  const rows = gradablePicks.map((pick) => {
    const regrade = regradeByPickId.get(pick.draftPickId);
    const draftNight = draftNightByPickId.get(pick.draftPickId);
    return {
      draft_pick_id: pick.draftPickId,
      season_points: pick.seasonPoints,
      expected_points: regrade.expectedPoints,
      voe: regrade.voe,
      regrade_grade: regrade.regradeGrade,
      regrade_rank: regrade.regradeRank,
      adp_at_pick: pick.adpAtPick,
      reach_value: draftNight.reachValue,
      draft_night_grade: draftNight.draftNightGrade,
    };
  });

  log("upserting", rows.length, "draft_pick_grades rows...");
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from("draft_pick_grades")
      .upsert(chunk, { onConflict: "draft_pick_id" });
    if (error) throw new Error(`draft_pick_grades upsert failed: ${error.message}`);
  }

  await recordDataGap(picksWithNoAdp, unmatchedDraftedPlayers, gradablePicks.length);

  log("done");
}

async function recordDataGap(picksWithNoAdp, unmatchedDraftedPlayers, totalPicks) {
  const description =
    "Draft Night Grade uses Fantasy Football Calculator's public historical " +
    "PPR ADP (fantasyfootballcalculator.com/api/v1/adp/ppr), a market-wide " +
    "consensus across that site's whole user base — not this league's own " +
    "draft date, 8-team format (2023 only), or draftees. Players are matched " +
    "to our `players` table by normalized name (D/ST by team mascot); " +
    `${picksWithNoAdp} of ${totalPicks} picks had no ADP match and were left ` +
    "null rather than guessed. Separately, 2023 running back season_points " +
    "are already known to be undercounted (see the 2023 rush-yardage " +
    "scoring-override gap in data/history/SUMMARY.md), which flows into that " +
    "year's Regrade/VOE numbers until that gap is resolved.";
  const assumption =
    "Treat Draft Night Grade as an approximate, third-party-sourced " +
    "estimate ('vs. market ADP') rather than ground truth; Regrade/VOE is " +
    "exact for 2024-2025 and approximate for 2023 RBs specifically.";

  const { data: existing, error: existingErr } = await supabase
    .from("data_gaps")
    .select("id")
    .eq("scope", "draft")
    .ilike("description", "Draft Night Grade uses Fantasy Football Calculator%")
    .limit(1);
  if (existingErr) throw existingErr;

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from("data_gaps")
      .update({ description, assumption })
      .eq("id", existing[0].id);
    if (error) throw error;
    log("updated existing data_gaps row", existing[0].id);
    return;
  }

  const { error } = await supabase
    .from("data_gaps")
    .insert({ scope: "draft", description, assumption, season_id: null });
  if (error) throw error;
  log("logged data_gaps row for draft grading approximations,", unmatchedDraftedPlayers, "unmatched drafted players");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
