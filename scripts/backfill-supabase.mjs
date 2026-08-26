// One-off backfill from local JSON extracts (data/history/) into the
// linked Supabase project. Uses the service-role key, bypasses RLS.
//
// Run with:
//   node --env-file=.env.local scripts/backfill-supabase.mjs
//
// This script is idempotent per season: for season-scoped tables it deletes
// existing rows for the season before inserting. Re-run safely.
//
// Known limitations / assumptions:
// - All ESPN scoringItems statIds used by this league are now mapped
//   (see ESPN_STAT_ID_TO_KEY below and src/lib/providers/espn/mappings.ts),
//   EXCEPT: this league's 2023 scoring config has `pointsOverrides` on
//   rush/rec yardage + TD stats (statIds 24, 25, 26, 42, 43, 44) keyed by
//   small integers (1-4, 15) that don't match any known ESPN position/slot
//   vocabulary. Those overrides are NOT applied — only the base `points`
//   value is used — and a loud warning is printed identifying which
//   statIds are affected. This needs commissioner confirmation before
//   2023 scores can be considered exact (see AGENTS.md "When requirements
//   are ambiguous"). statIds 109/114/115 use a D/ST-only pointsOverride
//   which we DO apply unambiguously (see DST_ONLY_OVERRIDE_STAT_IDS).
// - Roster slot counts come straight from ESPN's `mSettings` response
//   (data/espn-raw/{year}/settings-teams.json ->
//   settings.rosterSettings.lineupSlotCounts) — authoritative, not
//   inferred.
// - `stat_lines` are loaded from data/history/boxscore-stats-{year}.json
//   (produced by scripts/fetch-weekly-boxscore-stats.mjs, requires
//   ESPN_SWID/ESPN_S2). Run that script first, or this step is skipped
//   with a warning for years missing that file.
// - `transactions` are skipped — confirmed unrecoverable via ESPN's API
//   for this league (see the warning printed at the end of main()).

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);

const ESPN_POSITION_MAP = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "DST",
};

const ESPN_LINEUP_SLOT_MAP = {
  0: "QB",
  2: "RB",
  4: "WR",
  6: "TE",
  16: "DST",
  17: "K",
  20: "BE",
  21: "IR",
  23: "FLEX",
};

const SLOT_ELIGIBILITY = {
  QB: ["QB"],
  RB: ["RB"],
  WR: ["WR"],
  TE: ["TE"],
  FLEX: ["RB", "WR", "TE"],
  K: ["K"],
  DST: ["DST"],
  BE: ["QB", "RB", "WR", "TE", "K", "DST"],
  IR: ["QB", "RB", "WR", "TE", "K", "DST"],
};

// Matches src/lib/providers/espn/mappings.ts. Duplicated here so this one-off
// script can run without importing TypeScript. Keep in sync — see that
// file's header comment for provenance and the one still-unresolved gap
// (2023 position-keyed pointsOverrides on statIds 24, 25, 26, 42, 43, 44).
const ESPN_STAT_ID_TO_KEY = {
  3: "pass_yd",
  4: "pass_td",
  15: "pass_td_40_plus",
  16: "pass_td_50_plus",
  17: "pass_yd_300_399",
  18: "pass_yd_400_plus",
  19: "pass_2pt",
  20: "pass_int",
  64: "pass_sacked",
  24: "rush_yd",
  25: "rush_td",
  26: "rush_2pt",
  35: "rush_td_40_plus",
  36: "rush_td_50_plus",
  37: "rush_yd_100_199",
  38: "rush_yd_200_plus",
  42: "rec_yd",
  43: "rec_td",
  44: "rec_2pt",
  45: "rec_td_40_plus",
  46: "rec_td_50_plus",
  53: "rec",
  56: "rec_yd_100_199",
  57: "rec_yd_200_plus",
  58: "rec_target",
  63: "fum_rec_td",
  72: "fum_lost",
  77: "fg_40_49",
  80: "fg_0_39",
  83: "fg_made",
  85: "fg_miss",
  86: "xp_made",
  88: "xp_missed",
  198: "fg_50_59",
  201: "fg_60_plus",
  214: "fg_made_yards",
  89: "def_pa_0",
  90: "def_pa_1_6",
  91: "def_pa_7_13",
  92: "def_pa_14_17",
  123: "def_pa_28_34",
  124: "def_pa_35_45",
  125: "def_pa_46_plus",
  128: "def_yds_lt100",
  129: "def_yds_100_199",
  130: "def_yds_200_299",
  132: "def_yds_350_399",
  133: "def_yds_400_449",
  134: "def_yds_450_499",
  135: "def_yds_500_549",
  136: "def_yds_550_plus",
  93: "def_blk_kick_td",
  95: "def_int",
  96: "def_fum_rec",
  97: "def_blk_kick",
  98: "def_safety",
  99: "def_sack",
  101: "def_kr_td",
  102: "def_pr_td",
  103: "def_int_td",
  104: "def_fum_ret_td",
  109: "def_tackles",
  114: "def_kr_yd",
  115: "def_pr_yd",
  206: "def_2pt_ret",
  209: "def_1pt_safety",
};

/**
 * Resolves the real points-per-unit value for a scoringItem, accounting for
 * ESPN's pointsOverrides.
 *
 * Checked against this league's real scoring-by-season.json (all 3
 * seasons): D/ST-related stats store their point value in
 * `pointsOverrides["16"]` (16 = D/ST, matching ESPN_POSITION_MAP's
 * defaultPositionId used elsewhere in this codebase). There are two
 * distinct patterns here, confirmed via validate-scoring.mjs against
 * real stat_lines + ESPN-cached totals:
 *
 * 1. Base `points` is 0 and only the "16" override is non-zero (e.g.
 *    points-allowed/yards-allowed bands, sacks, team interceptions,
 *    tackles, return yards) — this stat is D/ST-EXCLUSIVE. Confirmed:
 *    Saints D/ST 2024 week 1 recomputes to exactly ESPN's cached 16.00
 *    only when these are restricted to position_filter=['DST'].
 * 2. Base `points` EQUALS the "16" override (e.g. statIds 93, 101, 102,
 *    103, 104 return-TD stats, 206 2pt return, 209 1pt safety) — the
 *    override is redundant, not restrictive: any position (e.g. a WR
 *    returning a punt for a TD) scores the same as D/ST. Confirmed:
 *    Rashid Shaheed (WR) scored a real punt-return TD (statId 102) in
 *    2024 week 6 and 2025 weeks 14/16; restricting statId 102 to
 *    D/ST-only undercounted his ESPN-cached total by exactly 6 points
 *    (this stat's value) every time until fixed to be unrestricted.
 *
 * Only 2023's rush/rec yardage + TD stats (statIds 24, 25, 26, 35, 36, 37,
 * 38) have MULTI-key overrides ("1","2","3","4","15") that don't match any
 * known ESPN position/slot vocabulary in this codebase or public
 * references. Those are NOT resolved here — the caller is told via
 * `ambiguous: true` so it can fall back to the base `points` value and
 * warn loudly (see AGENTS.md "When requirements are ambiguous").
 */
function resolveStatPoints(item) {
  const overrideKeys = Object.keys(item.pointsOverrides ?? {});
  if (overrideKeys.length === 0) {
    return { points: item.points ?? 0, ambiguous: false, positionFilter: null };
  }
  if (overrideKeys.length === 1 && overrideKeys[0] === "16") {
    const basePoints = item.points ?? 0;
    const dstPoints = item.pointsOverrides["16"];
    if (Number(basePoints) === Number(dstPoints)) {
      // Redundant override — applies to any position, same value.
      return { points: dstPoints, ambiguous: false, positionFilter: null };
    }
    // D/ST-exclusive: base points (for any other position) is different
    // (typically 0), so only D/ST scores this stat.
    return { points: dstPoints, ambiguous: false, positionFilter: ["DST"] };
  }
  return { points: item.points ?? 0, ambiguous: true, positionFilter: null };
}

function mapEspnStatId(statId) {
  return ESPN_STAT_ID_TO_KEY[Number(statId)] ?? null;
}

const STAT_KEY_DISPLAY = {
  pass_yd: "Passing Yards",
  pass_td: "Passing TDs",
  pass_td_40_plus: "40+ Yard TD Pass Bonus",
  pass_td_50_plus: "50+ Yard TD Pass Bonus",
  pass_yd_300_399: "300-399 Yard Passing Game",
  pass_yd_400_plus: "400+ Yard Passing Game",
  pass_2pt: "Passing 2-Pt Conversions",
  pass_int: "Interceptions",
  pass_sacked: "Times Sacked",
  rush_yd: "Rushing Yards",
  rush_td: "Rushing TDs",
  rush_td_40_plus: "40+ Yard TD Rush Bonus",
  rush_td_50_plus: "50+ Yard TD Rush Bonus",
  rush_yd_100_199: "100-199 Yard Rushing Game",
  rush_yd_200_plus: "200+ Yard Rushing Game",
  rush_2pt: "Rushing 2-Pt Conversions",
  rec_yd: "Receiving Yards",
  rec_td: "Receiving TDs",
  rec_td_40_plus: "40+ Yard TD Reception Bonus",
  rec_td_50_plus: "50+ Yard TD Reception Bonus",
  rec_yd_100_199: "100-199 Yard Receiving Game",
  rec_yd_200_plus: "200+ Yard Receiving Game",
  rec_target: "Targets",
  rec_2pt: "Receiving 2-Pt Conversions",
  rec: "Receptions",
  fum_rec_td: "Fumble Recovery TD",
  fum_lost: "Fumbles Lost",
  fg_40_49: "FG 40-49 Yards",
  fg_0_39: "FG 0-39 Yards",
  fg_50_59: "FG 50-59 Yards",
  fg_made: "FG Made (Any Distance)",
  fg_made_yards: "FG Made Yards (Per Yard)",
  fg_miss: "Missed FG",
  xp_made: "Extra Point Made",
  xp_missed: "Extra Point Missed",
  fg_60_plus: "FG 60+ Yards",
  def_pa_0: "Def Points Allowed 0",
  def_pa_1_6: "Def Points Allowed 1-6",
  def_pa_7_13: "Def Points Allowed 7-13",
  def_pa_14_17: "Def Points Allowed 14-17",
  def_pa_28_34: "Def Points Allowed 28-34",
  def_pa_35_45: "Def Points Allowed 35-45",
  def_pa_46_plus: "Def Points Allowed 46+",
  def_yds_lt100: "Def Yards Allowed <100",
  def_yds_100_199: "Def Yards Allowed 100-199",
  def_yds_200_299: "Def Yards Allowed 200-299",
  def_yds_350_399: "Def Yards Allowed 350-399",
  def_yds_400_449: "Def Yards Allowed 400-449",
  def_yds_450_499: "Def Yards Allowed 450-499",
  def_yds_500_549: "Def Yards Allowed 500-549",
  def_yds_550_plus: "Def Yards Allowed 550+",
  def_blk_kick_td: "Blocked Kick TD",
  def_int: "Interceptions",
  def_fum_rec: "Fumble Recoveries",
  def_blk_kick: "Blocked Kicks",
  def_safety: "Safeties",
  def_sack: "Sacks",
  def_kr_td: "Kick Return TD",
  def_pr_td: "Punt Return TD",
  def_int_td: "Interception Return TD",
  def_fum_ret_td: "Fumble Return TD",
  def_tackles: "Total Tackles (D/ST)",
  def_kr_yd: "Kickoff Return Yards (D/ST)",
  def_pr_yd: "Punt Return Yards (D/ST)",
  def_2pt_ret: "2-Point Return",
  def_1pt_safety: "1-Point Safety",
};

function loadJson(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), "utf-8"));
}

function log(...args) {
  console.log("[backfill]", ...args);
}

function warn(...args) {
  console.warn("[backfill warn]", ...args);
}

async function deleteSeasonScoped(table, seasonId, column = "season_id") {
  const { error } = await supabase.from(table).delete().eq(column, seasonId);
  if (error) throw new Error(`delete ${table} failed: ${error.message}`);
}

async function deleteLineupEntriesForSeason(seasonId) {
  const { data: teamIds, error } = await supabase
    .from("teams")
    .select("id")
    .eq("season_id", seasonId);
  if (error) throw new Error(`fetch team ids failed: ${error.message}`);
  if (teamIds.length === 0) return;
  const ids = teamIds.map((t) => t.id);
  const { error: delErr } = await supabase.from("lineup_entries").delete().in("team_id", ids);
  if (delErr) throw new Error(`delete lineup_entries failed: ${delErr.message}`);
}

async function loadLeague() {
  const leagues = loadJson("data/history/format-by-season.json");
  const years = Object.keys(leagues).map(Number).sort((a, b) => a - b);
  const leagueName = "Association of Try Hard Gamers";

  let { data, error } = await supabase
    .from("leagues")
    .select("id")
    .eq("name", leagueName)
    .limit(1);
  if (error) throw error;

  if (!data || data.length === 0) {
    const insert = await supabase.from("leagues").insert({ name: leagueName }).select();
    if (insert.error) throw insert.error;
    data = insert.data;
  }
  const league = data[0];
  log("league", league.id, leagueName);
  return { leagueId: league.id, years };
}

async function loadFranchises(leagueId) {
  const managers = loadJson("data/history/managers.json");
  const franchiseRows = managers.map((m) => ({
    league_id: leagueId,
    display_name: m.name,
    founded_year: Math.min(...m.seasonsActive),
    is_active: m.inferredRetiredAfterSeason === null,
    status: m.inferredRetiredAfterSeason === null ? "active" : "retired",
    og_manager: m.seasonsActive.includes(2023),
    espn_owner_ids: [m.espnOwnerId],
    retired_season: m.inferredRetiredAfterSeason,
    notes: null,
  }));

  const { data: existing, error: existingErr } = await supabase
    .from("franchises")
    .select("id, espn_owner_ids")
    .eq("league_id", leagueId);
  if (existingErr) throw existingErr;

  const existingByOwner = new Map();
  for (const row of existing ?? []) {
    for (const ownerId of row.espn_owner_ids) {
      existingByOwner.set(ownerId, row.id);
    }
  }

  const toInsert = [];
  for (const f of franchiseRows) {
    const ownerId = f.espn_owner_ids[0];
    if (!existingByOwner.has(ownerId)) {
      toInsert.push(f);
    }
  }

  if (toInsert.length > 0) {
    const { data, error } = await supabase.from("franchises").insert(toInsert).select();
    if (error) throw error;
    for (const row of data) {
      for (const ownerId of row.espn_owner_ids) {
        existingByOwner.set(ownerId, row.id);
      }
    }
  }

  log("franchises", "existing", existing?.length ?? 0, "inserted", toInsert.length);
  return existingByOwner;
}

async function loadSeasons(leagueId, years) {
  const format = loadJson("data/history/format-by-season.json");
  const seasonRows = years.map((year) => {
    const f = format[String(year)];
    return {
      league_id: leagueId,
      year,
      espn_league_id: "771894515",
      regular_weeks: f.matchupPeriodCount,
      playoff_teams: f.playoffTeamCount,
      is_locked: year < 2026,
      divisions: f.divisions ?? null,
      playoff_matchup_period_length: f.playoffMatchupPeriodLength ?? null,
      draft_type: f.draftType ?? null,
      keeper_count: f.keeperCount ?? null,
    };
  });

  const { data, error } = await supabase
    .from("seasons")
    .upsert(seasonRows, { onConflict: "league_id,year" })
    .select();
  if (error) throw error;

  const map = new Map();
  for (const row of data) {
    map.set(row.year, row.id);
  }
  log("seasons", [...map.keys()].join(", "));
  return map;
}

/**
 * Real draft position (snake-draft slot) per ESPN teamId, taken from each
 * team's round-1 pick. NOT the same as playoffSeed — those were previously
 * conflated (see AGENTS.md "Never do this" re: guessed/incorrect data).
 */
function buildDraftSlotMap(year) {
  const draftBySeason = loadJson("data/history/draft-picks-by-season.json");
  const picks = draftBySeason[String(year)] ?? [];
  const map = new Map();
  for (const pick of picks) {
    if (pick.roundId === 1) {
      map.set(pick.teamId, pick.roundPickNumber);
    }
  }
  return map;
}

async function loadTeams(seasonId, year, franchiseByOwner) {
  const teamsBySeason = loadJson("data/history/teams-by-season.json");
  const teams = teamsBySeason[String(year)] ?? [];
  const draftSlotByTeamId = buildDraftSlotMap(year);

  const rows = [];
  const unresolvedOwners = [];
  for (const t of teams) {
    const ownerId = t.owners?.[0];
    if (!ownerId || !franchiseByOwner.has(ownerId)) {
      unresolvedOwners.push({ team: t.name, ownerId });
      continue;
    }
    rows.push({
      season_id: seasonId,
      franchise_id: franchiseByOwner.get(ownerId),
      name: t.name,
      abbreviation: t.abbrev,
      logo_url: null,
      espn_team_id: String(t.teamId),
      draft_slot: draftSlotByTeamId.get(t.teamId) ?? null,
      wins: t.wins ?? null,
      losses: t.losses ?? null,
      ties: t.ties ?? 0,
      points_for: t.pointsFor ?? null,
      points_against: t.pointsAgainst ?? null,
      final_rank: t.rankCalculatedFinal ?? null,
      playoff_seed: t.playoffSeed ?? null,
    });
  }

  if (unresolvedOwners.length > 0) {
    warn("unresolved team owners for", year, unresolvedOwners);
  }

  const { data, error } = await supabase
    .from("teams")
    .upsert(rows, { onConflict: "season_id,franchise_id" })
    .select();
  if (error) throw error;

  const map = new Map();
  for (const row of data) {
    map.set(row.espn_team_id, row.id);
  }
  log("teams", year, data.length);
  return map;
}

/**
 * Reads the AUTHORITATIVE roster slot configuration straight from ESPN's
 * `mSettings` response (data/espn-raw/{year}/settings-teams.json ->
 * settings.rosterSettings.lineupSlotCounts), rather than inferring it from
 * which slots happened to appear in weekly roster snapshots. This is a
 * complete, exact source: every configured slot appears here even if it
 * was never actually filled in the fetched weeks.
 */
function loadRosterSlotsFromSettings(year) {
  const raw = loadJson(`data/espn-raw/${year}/settings-teams.json`);
  const [league] = raw;
  const counts = league.settings.rosterSettings.lineupSlotCounts;

  const unmappedSlotIds = [];
  const slots = [];
  for (const [slotIdRaw, count] of Object.entries(counts)) {
    if (count === 0) continue;
    const slotId = Number(slotIdRaw);
    const code = ESPN_LINEUP_SLOT_MAP[slotId];
    if (!code) {
      unmappedSlotIds.push(slotId);
      continue;
    }
    slots.push({ code, count });
  }

  // Order matters: starters first, then bench/IR.
  const order = ["QB", "RB", "WR", "TE", "FLEX", "K", "DST", "BE", "IR"];
  const sorted = slots
    .sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code))
    .map((s, idx) => ({
      slot_code: s.code,
      eligible_positions: SLOT_ELIGIBILITY[s.code],
      count: s.count,
      is_starting_slot: s.code !== "BE" && s.code !== "IR",
      sort_order: idx,
    }));

  return { slots: sorted, unmappedSlotIds };
}

async function loadRosterSlots(seasonId, year) {
  await deleteSeasonScoped("roster_slots", seasonId);
  const { slots, unmappedSlotIds } = loadRosterSlotsFromSettings(year);
  const rows = slots.map((s) => ({ season_id: seasonId, ...s }));
  const { error } = await supabase.from("roster_slots").insert(rows);
  if (error) throw error;
  if (unmappedSlotIds.length > 0) {
    warn(year, "unmapped lineupSlotIds in league settings:", unmappedSlotIds.join(", "));
  }
  log("roster_slots", year, slots.map((s) => `${s.slot_code}:${s.count}`).join(", "), "(source: mSettings, authoritative)");
}

async function loadStatCategories(scoringBySeason) {
  const seen = new Set();
  const rows = [];
  const unmapped = new Set();
  for (const yearConfig of Object.values(scoringBySeason)) {
    for (const statId of Object.keys(yearConfig.items)) {
      const key = mapEspnStatId(statId);
      if (key === null) {
        unmapped.add(statId);
        continue;
      }
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        key,
        display_name: STAT_KEY_DISPLAY[key] ?? key,
        unit: key.includes("yd") ? "yards" : key.includes("td") ? "count" : null,
        applies_to: key.startsWith("def_") ? ["DST"] : [],
      });
    }
  }
  if (rows.length > 0) {
    const { error } = await supabase.from("stat_categories").upsert(rows, {
      onConflict: "key",
      ignoreDuplicates: true,
    });
    if (error) throw error;
  }
  if (unmapped.size > 0) {
    warn("unmapped statIds skipped in stat_categories:", [...unmapped].join(", "));
  }
  log("stat_categories", rows.length);
}

/**
 * IMPORTANT: ESPN's boxscore does NOT send continuous point-allowed /
 * yards-allowed totals for D/ST scoring bands (def_pa_*, def_yds_*).
 * Instead it pre-computes each band as a 0/1 FLAG per team-week (e.g.
 * def_yds_100_199 = 1 means "yes, this team's D/ST allowed 100-199
 * yards this week", not a literal yardage count). Verified 2026-08-16
 * against real stat_lines + a known ESPN-cached score (Saints D/ST,
 * 2024 week 1: flag-multiplied sum = 16 = ESPN's cached 16.00; the
 * previously-used min/max threshold-range model, which treated the
 * flag as a real yardage value, produced a different, wrong total).
 *
 * Because of this, EVERY mapped stat in this league — including the
 * D/ST bands — is scored the same simple way: points_per_unit * value,
 * no thresholds. `min_value`/`max_value` are left null for all rows;
 * the scoring_rules schema still supports them for a provider that
 * genuinely sends continuous values requiring a threshold.
 */
async function loadScoringRules(seasonId, year, scoringConfig) {
  await deleteSeasonScoped("scoring_rules", seasonId);
  const rows = [];
  const ambiguousOverrides = [];
  const unmapped = new Set();
  let sortOrder = 0;
  for (const [statId, item] of Object.entries(scoringConfig.items)) {
    const key = mapEspnStatId(statId);
    if (key === null) {
      unmapped.add(statId);
      continue;
    }

    const resolved = resolveStatPoints(item);
    if (resolved.ambiguous) {
      ambiguousOverrides.push(statId);
    }

    rows.push({
      season_id: seasonId,
      stat_key: key,
      points_per_unit: resolved.points,
      flat_bonus: 0,
      min_value: null,
      max_value: null,
      position_filter: resolved.positionFilter,
      sort_order: sortOrder++,
    });
  }
  const { error } = await supabase.from("scoring_rules").insert(rows);
  if (error) throw error;
  if (ambiguousOverrides.length > 0) {
    warn(
      year,
      "NEEDS COMMISSIONER INPUT — multi-key pointsOverrides don't match any known position vocabulary; used base `points` value only (likely undercounts scoring) for statIds:",
      ambiguousOverrides.join(", "),
    );
  }
  if (unmapped.size > 0) {
    warn(year, "unmapped statIds skipped in scoring_rules:", [...unmapped].join(", "));
  }
  log("scoring_rules", year, rows.length);
}

async function loadPlayers() {
  const rosters23 = loadJson("data/history/rosters-2023.json");
  const rosters24 = loadJson("data/history/rosters-2024.json");
  const rosters25 = loadJson("data/history/rosters-2025.json");
  const allWeeks = [...rosters23, ...rosters24, ...rosters25];

  const playerById = new Map();
  for (const week of allWeeks) {
    for (const teamRoster of Object.values(week.teamRosters)) {
      for (const p of teamRoster) {
        if (!playerById.has(p.playerId)) {
          const position = ESPN_POSITION_MAP[p.defaultPositionId] ?? "UNKNOWN";
          playerById.set(p.playerId, {
            external_id: String(p.playerId),
            full_name: p.name,
            position,
            nfl_team: p.proTeamId !== null ? String(p.proTeamId) : null,
          });
        }
      }
    }
  }

  // Load existing players so we don't create duplicates (players has no unique
  // constraint on name/position, so we must match manually).
  const { data: existing, error: existingErr } = await supabase
    .from("players")
    .select("id, full_name, position");
  if (existingErr) throw existingErr;

  const keyToId = new Map();
  for (const p of existing ?? []) {
    keyToId.set(`${p.full_name}|${p.position}`, p.id);
  }

  const toInsert = [];
  for (const p of playerById.values()) {
    const key = `${p.full_name}|${p.position}`;
    if (!keyToId.has(key)) {
      toInsert.push({
        full_name: p.full_name,
        position: p.position,
        nfl_team: p.nfl_team,
      });
    }
  }

  if (toInsert.length > 0) {
    const { data: inserted, error } = await supabase.from("players").insert(toInsert).select();
    if (error) throw error;
    for (const p of inserted) {
      keyToId.set(`${p.full_name}|${p.position}`, p.id);
    }
  }

  const externalRows = [];
  for (const p of playerById.values()) {
    const playerId = keyToId.get(`${p.full_name}|${p.position}`);
    if (!playerId) {
      warn("player not found after insert:", p.full_name);
      continue;
    }
    externalRows.push({
      player_id: playerId,
      provider: "espn",
      external_id: p.external_id,
    });
  }

  if (externalRows.length > 0) {
    const { error: extErr } = await supabase
      .from("player_external_ids")
      .upsert(externalRows, { onConflict: "provider,external_id", ignoreDuplicates: true });
    if (extErr) throw extErr;
  }

  const espnToInternal = new Map();
  for (const p of playerById.values()) {
    espnToInternal.set(p.external_id, keyToId.get(`${p.full_name}|${p.position}`));
  }
  log("players", keyToId.size, "new", toInsert.length, "external ids", externalRows.length);
  return espnToInternal;
}

async function loadMatchups(seasonId, year, teamMap) {
  await deleteSeasonScoped("matchups", seasonId);
  const matchupsBySeason = loadJson("data/history/matchups-by-season.json");
  const matchups = matchupsBySeason[String(year)] ?? [];

  const rows = [];
  for (const m of matchups) {
    if (m.awayTeamId === null) {
      // Bye week; not a real matchup.
      continue;
    }
    if (!teamMap.has(String(m.homeTeamId)) || !teamMap.has(String(m.awayTeamId))) {
      warn("matchup team not found", year, m.homeTeamId, m.awayTeamId);
      continue;
    }
    rows.push({
      season_id: seasonId,
      week: m.week,
      home_team_id: teamMap.get(String(m.homeTeamId)),
      away_team_id: teamMap.get(String(m.awayTeamId)),
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
  log("matchups", year, rows.length);
}

async function loadLineupEntries(seasonId, year, teamMap, playerMap) {
  await deleteLineupEntriesForSeason(seasonId);
  const rosters = loadJson(`data/history/rosters-${year}.json`);
  const rows = [];
  const unmappedSlots = new Set();

  for (const week of rosters) {
    for (const [espnTeamId, teamRoster] of Object.entries(week.teamRosters)) {
      if (!teamMap.has(espnTeamId)) continue;
      const teamId = teamMap.get(espnTeamId);
      for (const entry of teamRoster) {
        const slotCode = ESPN_LINEUP_SLOT_MAP[entry.lineupSlotId];
        if (!slotCode) {
          unmappedSlots.add(entry.lineupSlotId);
          continue;
        }
        const playerId = playerMap.get(String(entry.playerId));
        if (!playerId) {
          warn("lineup player not found", year, entry.playerId, entry.name);
          continue;
        }
        rows.push({
          team_id: teamId,
          week: week.week,
          player_id: playerId,
          slot_code: slotCode,
          is_starter: slotCode !== "BE" && slotCode !== "IR",
          points: entry.weekPoints,
        });
      }
    }
  }

  // Insert in chunks to stay within PostgREST limits.
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("lineup_entries").insert(chunk);
    if (error) throw error;
  }
  if (unmappedSlots.size > 0) {
    warn(year, "unmapped lineupSlotIds:", [...unmappedSlots].join(", "));
  }
  log("lineup_entries", year, rows.length);
}

/**
 * Loads per-player, per-stat boxscore lines from
 * data/history/boxscore-stats-{year}.json (produced by
 * scripts/fetch-weekly-boxscore-stats.mjs) into `stat_lines`. Only
 * statIds present in ESPN_STAT_ID_TO_KEY are loaded — the 7 still-
 * ambiguous 2023 statIds (see resolveStatPoints) are skipped here too,
 * since scoring_rules for them uses a placeholder/base value.
 *
 * This makes `lib/scoring/engine.ts` runnable end-to-end against real
 * data (Phase 1.2 golden files) rather than only trusting ESPN's own
 * cached `weekPoints` in lineup_entries.
 */
async function loadStatLines(year, playerMap) {
  let weeks;
  try {
    weeks = loadJson(`data/history/boxscore-stats-${year}.json`);
  } catch {
    warn(year, "no boxscore-stats file found; skipping stat_lines for this year");
    return;
  }

  const rows = [];
  const unmappedStatIds = new Set();
  const unmatchedPlayers = new Set();

  for (const week of weeks) {
    for (const p of week.players) {
      const playerId = playerMap.get(String(p.playerId));
      if (!playerId) {
        unmatchedPlayers.add(p.playerId);
        continue;
      }
      for (const [statIdRaw, value] of Object.entries(p.stats)) {
        const key = mapEspnStatId(statIdRaw);
        if (key === null) {
          unmappedStatIds.add(statIdRaw);
          continue;
        }
        rows.push({
          player_id: playerId,
          year,
          week: week.week,
          stat_key: key,
          value,
          source: "espn",
        });
      }
    }
  }

  const chunkSize = 1000;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from("stat_lines")
      .upsert(chunk, { onConflict: "player_id,year,week,stat_key" });
    if (error) throw new Error(`stat_lines upsert failed: ${error.message}`);
  }

  if (unmappedStatIds.size > 0) {
    warn(year, "unmapped statIds skipped in stat_lines:", [...unmappedStatIds].join(", "));
  }
  if (unmatchedPlayers.size > 0) {
    warn(year, "players in boxscore not found in player map:", [...unmatchedPlayers].join(", "));
  }
  log("stat_lines", year, rows.length);
}

async function loadDraftPicks(seasonId, year, teamMap, playerMap) {
  await deleteSeasonScoped("draft_picks", seasonId);
  const draftBySeason = loadJson("data/history/draft-picks-by-season.json");
  const picks = draftBySeason[String(year)] ?? [];

  const rows = [];
  for (const p of picks) {
    if (!teamMap.has(String(p.teamId))) {
      warn("draft pick team not found", year, p.teamId);
      continue;
    }
    rows.push({
      season_id: seasonId,
      round: p.roundId,
      pick_in_round: p.roundPickNumber,
      overall_pick: p.overallPickNumber,
      team_id: teamMap.get(String(p.teamId)),
      player_id: playerMap.get(String(p.playerId)) ?? null,
      keeper: p.keeper,
      auction_cost: null,
    });
  }
  const { error } = await supabase.from("draft_picks").insert(rows);
  if (error) throw error;
  log("draft_picks", year, rows.length);
}

async function main() {
  log("starting backfill");
  const { leagueId, years } = await loadLeague();
  const franchiseByOwner = await loadFranchises(leagueId);
  const seasonMap = await loadSeasons(leagueId, years);
  const playerMap = await loadPlayers();

  const scoringBySeason = loadJson("data/history/scoring-by-season.json");
  await loadStatCategories(scoringBySeason);

  for (const year of years) {
    log("---", year, "---");
    const seasonId = seasonMap.get(year);
    const teamMap = await loadTeams(seasonId, year, franchiseByOwner);

    await loadRosterSlots(seasonId, year);
    await loadScoringRules(seasonId, year, scoringBySeason[String(year)]);
    await loadMatchups(seasonId, year, teamMap);
    await loadLineupEntries(seasonId, year, teamMap, playerMap);
    await loadDraftPicks(seasonId, year, teamMap, playerMap);
    await loadStatLines(year, playerMap);
  }

  warn(
    "transactions were NOT backfilled — confirmed unrecoverable via ESPN's API for this " +
      "league (mTransactions2 returns no transactions key even with the correct " +
      "x-fantasy-filter header; the communication/kona_league_communication activity feed " +
      "404s for past seasons and is empty for the live 2026 season). Re-verified 2026-08-16.",
  );
  log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
