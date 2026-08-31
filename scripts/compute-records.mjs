// Computes the League Records feature (ROADMAP.md 3.2 "Record book" /
// 3.5.1 "Derived stats") and writes `record_definitions` +
// `record_results` (see supabase/migrations/20260101000011_league_records.sql
// and schema.sql's `record_results` comment).
//
// THIS FILE MIRRORS src/lib/records/engine.ts's LOGIC IN PLAIN JS (same
// convention as ESPN_STAT_ID_TO_KEY in backfill-supabase.mjs / the
// grading-logic duplication in compute-draft-grades.mjs, because this
// one-off script runs without a TypeScript toolchain). Keep the two in
// sync -- and see engine.ts's doc comments for the full explanation of
// each method (all-play luck, streak detection, margins, etc.); this
// file only repeats what's necessary to follow the control flow.
//
// Run with:
//   node --env-file=.env.local scripts/compute-records.mjs
//
// Season scope / playoff scope decisions (see ROADMAP.md and the
// records feature plan for the full reasoning):
// - EXCLUDED_SEASON_YEARS below is season 1 (2023): materially
//   different scoring rules and team count, would skew every
//   comparison. This is an explicit exclusion list, not "most recent
//   N seasons", so a future season 4 is automatically included
//   without touching this file.
// - "Playoff" = `matchups.playoff_bracket = 'winners'` ONLY. Games in
//   `winners_consolation` (placement games among playoff teams) or
//   `losers_consolation` (bottom teams that missed the playoffs) are
//   excluded from every record entirely -- not counted as regular
//   season either, since they're not part of the normal schedule.
// - Manager identity = `franchises.id` (already the stable identity
//   used everywhere else in this app; see data/history/SUMMARY.md's
//   "Resolved (commissioner-confirmed)" note).

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function log(...args) {
  console.log("[compute-records]", ...args);
}
function warn(...args) {
  console.warn("[compute-records warn]", ...args);
}

const EXCLUDED_SEASON_YEARS = [2023, 2026];

// ---- mirrors src/lib/records/engine.ts — keep in sync ----

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const k = keyFn(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function tiedBest(items, valueFn, direction, toHolder) {
  if (items.length === 0) return { value: 0, holders: [] };
  const values = items.map(valueFn);
  const best = direction === "max" ? Math.max(...values) : Math.min(...values);
  const holders = items.filter((item) => valueFn(item) === best).map(toHolder);
  return { value: best, holders };
}

function resultValue(game) {
  if (game.points > game.opponentPoints) return 1;
  if (game.points === game.opponentPoints) return 0.5;
  return 0;
}

function highestSingleWeek(games) {
  return tiedBest(games, (g) => g.points, "max", (g) => ({
    franchiseId: g.franchiseId,
    context: { seasonYear: g.seasonYear, week: g.week, opponentFranchiseId: g.opponentFranchiseId },
  }));
}
function lowestSingleWeek(games) {
  return tiedBest(games, (g) => g.points, "min", (g) => ({
    franchiseId: g.franchiseId,
    context: { seasonYear: g.seasonYear, week: g.week, opponentFranchiseId: g.opponentFranchiseId },
  }));
}

function seasonTotals(games) {
  const bySeasonFranchise = groupBy(games, (g) => `${g.franchiseId}|${g.seasonYear}`);
  return [...bySeasonFranchise.entries()].map(([key, list]) => {
    const [franchiseId, seasonYearStr] = key.split("|");
    return { franchiseId, seasonYear: Number(seasonYearStr), totalPoints: list.reduce((s, g) => s + g.points, 0) };
  });
}
function highestScoringSeason(totals) {
  return tiedBest(totals, (t) => t.totalPoints, "max", (t) => ({ franchiseId: t.franchiseId, context: { seasonYear: t.seasonYear } }));
}
function lowestScoringSeason(totals) {
  return tiedBest(totals, (t) => t.totalPoints, "min", (t) => ({ franchiseId: t.franchiseId, context: { seasonYear: t.seasonYear } }));
}

function seasonMargins(games) {
  const bySeasonFranchise = groupBy(games, (g) => `${g.franchiseId}|${g.seasonYear}`);
  return [...bySeasonFranchise.entries()].map(([key, list]) => {
    const [franchiseId, seasonYearStr] = key.split("|");
    const wins = list.filter((g) => g.points > g.opponentPoints);
    const losses = list.filter((g) => g.points < g.opponentPoints);
    return {
      franchiseId,
      seasonYear: Number(seasonYearStr),
      avgMarginOfVictory: wins.length > 0 ? wins.reduce((s, g) => s + (g.points - g.opponentPoints), 0) / wins.length : null,
      avgMarginOfDefeat: losses.length > 0 ? losses.reduce((s, g) => s + (g.opponentPoints - g.points), 0) / losses.length : null,
    };
  });
}
function bestAvgMarginOfVictory(margins) {
  const withValue = margins.filter((m) => m.avgMarginOfVictory != null);
  return tiedBest(withValue, (m) => m.avgMarginOfVictory, "max", (m) => ({ franchiseId: m.franchiseId, context: { seasonYear: m.seasonYear } }));
}
function worstAvgMarginOfDefeat(margins) {
  const withValue = margins.filter((m) => m.avgMarginOfDefeat != null);
  return tiedBest(withValue, (m) => m.avgMarginOfDefeat, "max", (m) => ({ franchiseId: m.franchiseId, context: { seasonYear: m.seasonYear } }));
}

function longestStreaksPerFranchise(games, type) {
  const byFranchise = groupBy(games, (g) => g.franchiseId);
  const results = [];
  for (const [franchiseId, list] of byFranchise) {
    const sorted = [...list].sort((a, b) => a.seasonYear - b.seasonYear || a.week - b.week);
    let currentLength = 0;
    let currentStart = null;
    let best = null;
    for (const game of sorted) {
      const matches = type === "win" ? game.points > game.opponentPoints : game.points < game.opponentPoints;
      if (matches) {
        if (currentLength === 0) currentStart = game;
        currentLength += 1;
        if (!best || currentLength > best.length) {
          best = {
            franchiseId,
            length: currentLength,
            startSeasonYear: currentStart.seasonYear,
            startWeek: currentStart.week,
            endSeasonYear: game.seasonYear,
            endWeek: game.week,
            crossSeason: currentStart.seasonYear !== game.seasonYear,
          };
        }
      } else {
        currentLength = 0;
        currentStart = null;
      }
    }
    if (best) results.push(best);
  }
  return results;
}
function longestWinStreak(games) {
  return tiedBest(longestStreaksPerFranchise(games, "win"), (s) => s.length, "max", (s) => ({
    franchiseId: s.franchiseId,
    context: { startSeasonYear: s.startSeasonYear, startWeek: s.startWeek, endSeasonYear: s.endSeasonYear, endWeek: s.endWeek, crossSeason: s.crossSeason },
  }));
}
function longestLosingStreak(games) {
  return tiedBest(longestStreaksPerFranchise(games, "loss"), (s) => s.length, "max", (s) => ({
    franchiseId: s.franchiseId,
    context: { startSeasonYear: s.startSeasonYear, startWeek: s.startWeek, endSeasonYear: s.endSeasonYear, endWeek: s.endWeek, crossSeason: s.crossSeason },
  }));
}

// All-play luck: see engine.ts's doc comment for the full explanation.
// IMPORTANT: beatCount must be normalized by /(fieldSize - 1) before
// summing across weeks, since a real win is 1 game out of 1 while
// beatCount is out of (fieldSize - 1) opponents -- without this, every
// good team looks impossibly "unlucky" purely from field size, not
// actual luck (caught by spot-checking a live run against real data).
function seasonAllPlayLuck(games) {
  const byWeek = groupBy(games, (g) => `${g.seasonYear}|${g.week}`);
  const wouldBeWinsByFranchiseSeason = new Map();
  for (const [weekKey, entries] of byWeek) {
    const week = Number(weekKey.split("|")[1]);
    const fieldSize = entries.length;
    for (const entry of entries) {
      let beatCount = 0;
      for (const other of entries) {
        if (other === entry) continue;
        if (entry.points > other.points) beatCount += 1;
        else if (entry.points === other.points) beatCount += 0.5;
      }
      const wouldBeWinsThatWeek = fieldSize > 1 ? beatCount / (fieldSize - 1) : 0;
      const key = `${entry.franchiseId}|${entry.seasonYear}`;
      const bucket = wouldBeWinsByFranchiseSeason.get(key) ?? { total: 0, detail: [] };
      bucket.total += wouldBeWinsThatWeek;
      bucket.detail.push({ week, beatCount, fieldSize, wouldBeWinsThatWeek });
      wouldBeWinsByFranchiseSeason.set(key, bucket);
    }
  }
  const actualWinsByFranchiseSeason = groupBy(games, (g) => `${g.franchiseId}|${g.seasonYear}`);
  return [...actualWinsByFranchiseSeason.entries()].map(([key, list]) => {
    const [franchiseId, seasonYearStr] = key.split("|");
    const actualWins = list.reduce((s, g) => s + resultValue(g), 0);
    const bucket = wouldBeWinsByFranchiseSeason.get(key) ?? { total: 0, detail: [] };
    return {
      franchiseId,
      seasonYear: Number(seasonYearStr),
      actualWins,
      wouldBeWins: bucket.total,
      luckGap: actualWins - bucket.total,
      weeklyDetail: bucket.detail.sort((a, b) => a.week - b.week),
    };
  });
}
function luckiestSeason(luck) {
  return tiedBest(luck, (l) => l.luckGap, "max", (l) => ({ franchiseId: l.franchiseId, context: { seasonYear: l.seasonYear, actualWins: l.actualWins, wouldBeWins: l.wouldBeWins } }));
}
function unluckiestSeason(luck) {
  return tiedBest(luck, (l) => l.luckGap, "min", (l) => ({ franchiseId: l.franchiseId, context: { seasonYear: l.seasonYear, actualWins: l.actualWins, wouldBeWins: l.wouldBeWins } }));
}

function toughestSchedule(games, regularSeasonTotals) {
  const totalByKey = new Map(regularSeasonTotals.map((t) => [`${t.franchiseId}|${t.seasonYear}`, t.totalPoints]));
  const bySeasonFranchise = groupBy(games, (g) => `${g.franchiseId}|${g.seasonYear}`);
  return [...bySeasonFranchise.entries()].map(([key, list]) => {
    const [franchiseId, seasonYearStr] = key.split("|");
    const seasonYear = Number(seasonYearStr);
    const opponentPointsSum = list.reduce((sum, g) => sum + (totalByKey.get(`${g.opponentFranchiseId}|${seasonYear}`) ?? 0), 0);
    return { franchiseId, seasonYear, opponentPointsSum };
  });
}
function toughestScheduleAllTime(list) {
  return tiedBest(list, (t) => t.opponentPointsSum, "max", (t) => ({ franchiseId: t.franchiseId, context: { seasonYear: t.seasonYear } }));
}
function easiestScheduleAllTime(list) {
  return tiedBest(list, (t) => t.opponentPointsSum, "min", (t) => ({ franchiseId: t.franchiseId, context: { seasonYear: t.seasonYear } }));
}

// ---- record_definitions registry ----
// Metadata only (title/description/scope/direction) -- no scores or
// invented numbers, so this is safe to keep in a migration-adjacent
// script rather than a hand-reviewed migration (see AGENTS.md "Never
// hardcode a point value" -- these aren't point values).
const DEFINITIONS = [
  { key: "alltime_highest_scoring_season", title: "Highest Scoring Season", description: "Most total regular-season points in a single season.", scope: "alltime", direction: "desc" },
  { key: "alltime_highest_scoring_playoff_run", title: "Highest Scoring Playoff Run", description: "Most total points across the winners-bracket playoff run in a single season.", scope: "alltime", direction: "desc" },
  { key: "alltime_lowest_scoring_season", title: "Lowest Scoring Season", description: "Fewest total regular-season points in a single season.", scope: "alltime", direction: "asc" },
  { key: "alltime_highest_single_week_regular", title: "Highest Single Week Score (Regular Season)", description: "Most points scored in a single regular-season week.", scope: "alltime", direction: "desc" },
  { key: "alltime_highest_single_week_playoff", title: "Highest Single Week Score (Playoffs)", description: "Most points scored in a single winners-bracket playoff week.", scope: "alltime", direction: "desc" },
  { key: "alltime_lowest_single_week_regular", title: "Lowest Single Week Score (Regular Season)", description: "Fewest points scored in a single regular-season week.", scope: "alltime", direction: "asc" },
  { key: "alltime_lowest_single_week_playoff", title: "Lowest Single Week Score (Playoffs)", description: "Fewest points scored in a single winners-bracket playoff week.", scope: "alltime", direction: "asc" },
  { key: "alltime_best_avg_margin_of_victory", title: "Best Season Average Margin of Victory", description: "Highest average margin of victory across a regular season (wins only).", scope: "alltime", direction: "desc" },
  { key: "alltime_worst_avg_margin_of_defeat", title: "Worst Season Average Margin of Defeat", description: "Highest average margin of defeat across a regular season (losses only).", scope: "alltime", direction: "desc" },
  { key: "alltime_longest_win_streak", title: "Longest Win Streak", description: "Longest regular-season win streak; may cross the 2024→2025 season boundary (labeled crossSeason in context).", scope: "alltime", direction: "desc" },
  { key: "alltime_longest_losing_streak", title: "Longest Losing Streak", description: "Longest regular-season losing streak; may cross the 2024→2025 season boundary (labeled crossSeason in context).", scope: "alltime", direction: "desc" },
  { key: "alltime_unluckiest_season", title: "Unluckiest Season", description: "Scored well enough to win a lot more games than they actually did, based on comparing every week's score to the whole league. Regular season only.", scope: "alltime", direction: "asc" },
  { key: "alltime_luckiest_season", title: "Luckiest Season", description: "Won more real games than their scores really deserved, based on comparing every week's score to the whole league. Regular season only.", scope: "alltime", direction: "desc" },
  { key: "alltime_toughest_schedule", title: "Toughest Schedule Faced", description: "Highest sum of opponents' season-total regular-season points.", scope: "alltime", direction: "desc" },
  { key: "alltime_easiest_schedule", title: "Easiest Schedule Faced", description: "Lowest sum of opponents' season-total regular-season points.", scope: "alltime", direction: "asc" },

  { key: "season_high_score", title: "Season High Score (Single Week)", description: "Highest single-week score that season, regular season and playoffs computed separately (see is_playoff in context).", scope: "season", direction: "desc" },
  { key: "season_low_score", title: "Season Low Score (Single Week)", description: "Lowest single-week score that season, regular season and playoffs computed separately (see is_playoff in context).", scope: "season", direction: "asc" },
  { key: "season_total_points", title: "Season Total Points (Regular Season)", description: "Every manager's regular-season point total that season.", scope: "season", direction: "desc" },
  { key: "season_avg_margin_of_victory", title: "Season Average Margin of Victory", description: "Every manager's average margin of victory that season (regular season, wins only).", scope: "season", direction: "desc" },
  { key: "season_avg_margin_of_defeat", title: "Season Average Margin of Defeat", description: "Every manager's average margin of defeat that season (regular season, losses only).", scope: "season", direction: "desc" },
  { key: "season_longest_win_streak", title: "Season Longest Win Streak", description: "Every manager's longest regular-season win streak within that season only.", scope: "season", direction: "desc" },
  { key: "season_longest_losing_streak", title: "Season Longest Losing Streak", description: "Every manager's longest regular-season losing streak within that season only.", scope: "season", direction: "desc" },
  { key: "season_luck_score", title: "Season Luck Score", description: "How each manager's real win total compares to what their scores deserved that season. Positive = lucky (won more than deserved), negative = unlucky. Regular season only.", scope: "season", direction: "desc" },

  { key: "franchise_transaction_activity", title: "Roster Transaction Activity", description: "Add/drop/trade/waiver transaction counts per manager. See data_gaps if this league's history is unavailable from ESPN.", scope: "season", direction: "desc" },
  { key: "franchise_injury_approx_starts", title: "Approximate Injury/Bye Starts", description: "APPROXIMATION: weeks a manager started a player who scored exactly 0. No injury/bye/status field exists in this schema, so this cannot distinguish an injured/bye starter from a healthy player who scored 0 — false positives are expected. See data_gaps.", scope: "season", direction: "desc" },
];

async function loadLeagueId() {
  const { data, error } = await supabase.from("leagues").select("id, name").limit(1);
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("No leagues row found — run scripts/backfill-supabase.mjs first.");
  }
  return data[0].id;
}

async function loadIncludedSeasons() {
  const { data, error } = await supabase.from("seasons").select("id, year");
  if (error) throw error;
  const included = (data ?? []).filter((s) => !EXCLUDED_SEASON_YEARS.includes(s.year));
  const excluded = (data ?? []).filter((s) => EXCLUDED_SEASON_YEARS.includes(s.year));
  if (excluded.length > 0) {
    log("excluding season(s):", excluded.map((s) => s.year).join(", "));
  }
  return included;
}

/** Builds the TeamWeekResult[] (see engine.ts) for the included
 * seasons: one row per franchise per qualifying matchup. Consolation
 * bracket games are dropped entirely (see header comment). */
async function loadTeamWeekResults(seasons) {
  const seasonIds = seasons.map((s) => s.id);
  const yearBySeasonId = new Map(seasons.map((s) => [s.id, s.year]));

  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .select("id, season_id, franchise_id")
    .in("season_id", seasonIds);
  if (teamsErr) throw teamsErr;
  const franchiseIdByTeamId = new Map(teams.map((t) => [t.id, t.franchise_id]));

  const { data: matchups, error: matchupsErr } = await supabase
    .from("matchups")
    .select("week, home_team_id, away_team_id, home_score, away_score, is_playoff, playoff_bracket, is_final")
    .in("season_id", seasonIds);
  if (matchupsErr) throw matchupsErr;

  const results = [];
  let skippedConsolation = 0;
  let skippedIncomplete = 0;
  for (const m of matchups) {
    if (m.is_playoff && m.playoff_bracket !== "winners") {
      skippedConsolation += 1;
      continue;
    }
    if (m.home_score == null || m.away_score == null) {
      skippedIncomplete += 1;
      continue;
    }
    const homeFranchiseId = franchiseIdByTeamId.get(m.home_team_id);
    const awayFranchiseId = franchiseIdByTeamId.get(m.away_team_id);
    if (!homeFranchiseId || !awayFranchiseId) continue;
    // seasonYear is looked up per-team since the query above joined by
    // season_id already scoped to `seasons`; team_id -> season_id ->
    // year is a 1:1 chain, safe to resolve either side the same way.
    const seasonId = teams.find((t) => t.id === m.home_team_id)?.season_id;
    const seasonYear = yearBySeasonId.get(seasonId);
    if (seasonYear == null) continue;

    results.push({ franchiseId: homeFranchiseId, seasonYear, week: m.week, points: m.home_score, opponentFranchiseId: awayFranchiseId, opponentPoints: m.away_score, isPlayoff: m.is_playoff });
    results.push({ franchiseId: awayFranchiseId, seasonYear, week: m.week, points: m.away_score, opponentFranchiseId: homeFranchiseId, opponentPoints: m.home_score, isPlayoff: m.is_playoff });
  }
  log(`built ${results.length} team-week results (skipped ${skippedConsolation} consolation-bracket team-games, ${skippedIncomplete} incomplete matchups)`);
  return results;
}

async function upsertDefinitions(leagueId) {
  const rows = DEFINITIONS.map((d, i) => ({
    league_id: leagueId,
    key: d.key,
    title: d.title,
    description: d.description,
    scope: d.scope,
    direction: d.direction,
    query_name: d.key,
    is_featured: d.scope === "alltime",
    sort_order: i,
  }));
  const { data, error } = await supabase
    .from("record_definitions")
    .upsert(rows, { onConflict: "league_id,key" })
    .select("id, key");
  if (error) throw error;
  return new Map(data.map((d) => [d.key, d.id]));
}

/** Replaces every stored result for one definition (all scopes) --
 * idempotent, safe to re-run (same pattern as backfill-supabase.mjs's
 * per-season delete-then-insert). */
async function replaceResults(definitionId, rows) {
  const { error: deleteErr } = await supabase.from("record_results").delete().eq("record_definition_id", definitionId);
  if (deleteErr) throw deleteErr;
  if (rows.length === 0) return;
  const { error: insertErr } = await supabase.from("record_results").insert(rows);
  if (insertErr) throw insertErr;
}

function holdersToRows(definitionId, tiedRecord, scope, seasonYear, isPlayoff) {
  return tiedRecord.holders.map((h) => ({
    record_definition_id: definitionId,
    scope,
    season_year: scope === "season" ? seasonYear : null,
    is_playoff: isPlayoff,
    franchise_id: h.franchiseId,
    value: tiedRecord.value,
    context: h.context,
  }));
}

function leaderboardToRows(definitionId, entries, scope, seasonYear, isPlayoff, valueFn, contextFn) {
  return entries.map((e) => ({
    record_definition_id: definitionId,
    scope,
    season_year: scope === "season" ? seasonYear : null,
    is_playoff: isPlayoff,
    franchise_id: e.franchiseId,
    value: valueFn(e),
    context: contextFn(e),
  }));
}

async function computeAndStoreAllTime(defIds, allGames) {
  const regular = allGames.filter((g) => !g.isPlayoff);
  const playoff = allGames.filter((g) => g.isPlayoff);
  const regularTotals = seasonTotals(regular);
  const playoffTotals = seasonTotals(playoff);
  const margins = seasonMargins(regular);
  const luck = seasonAllPlayLuck(regular);
  const schedules = toughestSchedule(regular, regularTotals);

  const jobs = [
    ["alltime_highest_scoring_season", holdersToRows(defIds.get("alltime_highest_scoring_season"), highestScoringSeason(regularTotals), "alltime", null, false)],
    ["alltime_highest_scoring_playoff_run", holdersToRows(defIds.get("alltime_highest_scoring_playoff_run"), highestScoringSeason(playoffTotals), "alltime", null, true)],
    ["alltime_lowest_scoring_season", holdersToRows(defIds.get("alltime_lowest_scoring_season"), lowestScoringSeason(regularTotals), "alltime", null, false)],
    ["alltime_highest_single_week_regular", holdersToRows(defIds.get("alltime_highest_single_week_regular"), highestSingleWeek(regular), "alltime", null, false)],
    ["alltime_highest_single_week_playoff", holdersToRows(defIds.get("alltime_highest_single_week_playoff"), highestSingleWeek(playoff), "alltime", null, true)],
    ["alltime_lowest_single_week_regular", holdersToRows(defIds.get("alltime_lowest_single_week_regular"), lowestSingleWeek(regular), "alltime", null, false)],
    ["alltime_lowest_single_week_playoff", holdersToRows(defIds.get("alltime_lowest_single_week_playoff"), lowestSingleWeek(playoff), "alltime", null, true)],
    ["alltime_best_avg_margin_of_victory", holdersToRows(defIds.get("alltime_best_avg_margin_of_victory"), bestAvgMarginOfVictory(margins), "alltime", null, false)],
    ["alltime_worst_avg_margin_of_defeat", holdersToRows(defIds.get("alltime_worst_avg_margin_of_defeat"), worstAvgMarginOfDefeat(margins), "alltime", null, false)],
    ["alltime_longest_win_streak", holdersToRows(defIds.get("alltime_longest_win_streak"), longestWinStreak(regular), "alltime", null, false)],
    ["alltime_longest_losing_streak", holdersToRows(defIds.get("alltime_longest_losing_streak"), longestLosingStreak(regular), "alltime", null, false)],
    ["alltime_unluckiest_season", holdersToRows(defIds.get("alltime_unluckiest_season"), unluckiestSeason(luck), "alltime", null, false)],
    ["alltime_luckiest_season", holdersToRows(defIds.get("alltime_luckiest_season"), luckiestSeason(luck), "alltime", null, false)],
    ["alltime_toughest_schedule", holdersToRows(defIds.get("alltime_toughest_schedule"), toughestScheduleAllTime(schedules), "alltime", null, false)],
    ["alltime_easiest_schedule", holdersToRows(defIds.get("alltime_easiest_schedule"), easiestScheduleAllTime(schedules), "alltime", null, false)],
  ];

  for (const [key, rows] of jobs) {
    await replaceResults(defIds.get(key), rows);
    log(`  ${key}: ${rows.length} row(s)`);
  }
}

async function computeAndStorePerSeason(defIds, allGames, years) {
  // These definitions carry a full per-manager leaderboard (one row
  // per franchise, not just the tied extreme) so the per-season page
  // can render a complete stat table. See compute-records.mjs header
  // comment / the plan for why this differs from the all-time
  // categories, which store only the tied best/worst.
  const leaderboardKeys = [
    "season_total_points",
    "season_avg_margin_of_victory",
    "season_avg_margin_of_defeat",
    "season_longest_win_streak",
    "season_longest_losing_streak",
    "season_luck_score",
  ];
  for (const key of leaderboardKeys) {
    let allRows = [];
    for (const year of years) {
      const seasonGames = allGames.filter((g) => g.seasonYear === year && !g.isPlayoff);
      if (key === "season_total_points") {
        allRows = allRows.concat(leaderboardToRows(defIds.get(key), seasonTotals(seasonGames), "season", year, false, (e) => e.totalPoints, () => ({})));
      } else if (key === "season_avg_margin_of_victory") {
        const margins = seasonMargins(seasonGames).filter((m) => m.avgMarginOfVictory != null);
        allRows = allRows.concat(leaderboardToRows(defIds.get(key), margins, "season", year, false, (e) => e.avgMarginOfVictory, () => ({})));
      } else if (key === "season_avg_margin_of_defeat") {
        const margins = seasonMargins(seasonGames).filter((m) => m.avgMarginOfDefeat != null);
        allRows = allRows.concat(leaderboardToRows(defIds.get(key), margins, "season", year, false, (e) => e.avgMarginOfDefeat, () => ({})));
      } else if (key === "season_longest_win_streak") {
        allRows = allRows.concat(leaderboardToRows(defIds.get(key), longestStreaksPerFranchise(seasonGames, "win"), "season", year, false, (e) => e.length, (e) => ({ startWeek: e.startWeek, endWeek: e.endWeek })));
      } else if (key === "season_longest_losing_streak") {
        allRows = allRows.concat(leaderboardToRows(defIds.get(key), longestStreaksPerFranchise(seasonGames, "loss"), "season", year, false, (e) => e.length, (e) => ({ startWeek: e.startWeek, endWeek: e.endWeek })));
      } else if (key === "season_luck_score") {
        allRows = allRows.concat(leaderboardToRows(defIds.get(key), seasonAllPlayLuck(seasonGames), "season", year, false, (e) => e.luckGap, (e) => ({ actualWins: e.actualWins, wouldBeWins: e.wouldBeWins, weeklyDetail: e.weeklyDetail })));
      }
    }
    await replaceResults(defIds.get(key), allRows);
    log(`  ${key}: ${allRows.length} row(s) across ${years.length} season(s)`);
  }

  // season_high_score / season_low_score: single tied extreme per
  // season, regular season and playoffs stored separately via is_playoff.
  let highRows = [];
  let lowRows = [];
  for (const year of years) {
    for (const isPlayoff of [false, true]) {
      const pool = allGames.filter((g) => g.seasonYear === year && g.isPlayoff === isPlayoff);
      highRows = highRows.concat(holdersToRows(defIds.get("season_high_score"), highestSingleWeek(pool), "season", year, isPlayoff));
      lowRows = lowRows.concat(holdersToRows(defIds.get("season_low_score"), lowestSingleWeek(pool), "season", year, isPlayoff));
    }
  }
  await replaceResults(defIds.get("season_high_score"), highRows);
  await replaceResults(defIds.get("season_low_score"), lowRows);
  log(`  season_high_score: ${highRows.length} row(s)`);
  log(`  season_low_score: ${lowRows.length} row(s)`);
}

async function recordDataGap(scope, description, assumption) {
  const { data: existing, error: existingErr } = await supabase
    .from("data_gaps")
    .select("id")
    .eq("scope", scope)
    .ilike("description", `${description.slice(0, 40)}%`)
    .limit(1);
  if (existingErr) throw existingErr;
  if (existing && existing.length > 0) {
    const { error } = await supabase.from("data_gaps").update({ description, assumption }).eq("id", existing[0].id);
    if (error) throw error;
    log("updated existing data_gaps row", existing[0].id);
    return;
  }
  const { error } = await supabase.from("data_gaps").insert({ scope, description, assumption, season_id: null });
  if (error) throw error;
  log("logged data_gaps row:", scope);
}

async function computeTransactionActivity(defIds, seasons) {
  const seasonIds = seasons.map((s) => s.id);
  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("season_id, team_id")
    .in("season_id", seasonIds);
  if (error) throw error;

  if (!transactions || transactions.length === 0) {
    await recordDataGap(
      "roster",
      "Roster transaction history (add/drop/trade/waiver) is unavailable for this league. " +
        "ESPN's API does not retain it for past seasons for this league (confirmed via " +
        "view=mTransactions2 and the kona_league_communication feed — see " +
        "data/history/SUMMARY.md's 'Transactions could not be pulled' note). The " +
        "`transactions` table exists in the schema and is checked live by " +
        "scripts/compute-records.mjs on every run, so this record will populate " +
        "automatically once transaction data is captured going forward.",
      "franchise_transaction_activity is intentionally left empty rather than showing " +
        "fabricated zeros; recommend logging transactions going forward via a sync job " +
        "against ESPN's live communication feed (which does return data for the current season).",
    );
    await replaceResults(defIds.get("franchise_transaction_activity"), []);
    log("  franchise_transaction_activity: 0 rows (data gap logged — no transaction history available)");
    return;
  }

  const { data: teams, error: teamsErr } = await supabase.from("teams").select("id, season_id, franchise_id").in("season_id", seasonIds);
  if (teamsErr) throw teamsErr;
  const franchiseIdByTeamId = new Map(teams.map((t) => [t.id, t.franchise_id]));
  const yearBySeasonId = new Map(seasons.map((s) => [s.id, s.year]));

  const counts = new Map(); // franchiseId|year -> count
  for (const t of transactions) {
    if (!t.team_id) continue;
    const franchiseId = franchiseIdByTeamId.get(t.team_id);
    const year = yearBySeasonId.get(t.season_id);
    if (!franchiseId || year == null) continue;
    const key = `${franchiseId}|${year}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const rows = [...counts.entries()].map(([key, count]) => {
    const [franchiseId, yearStr] = key.split("|");
    return { record_definition_id: defIds.get("franchise_transaction_activity"), scope: "season", season_year: Number(yearStr), is_playoff: false, franchise_id: franchiseId, value: count, context: {} };
  });
  await replaceResults(defIds.get("franchise_transaction_activity"), rows);
  log(`  franchise_transaction_activity: ${rows.length} row(s)`);
}

async function computeInjuryApproximation(defIds, seasons) {
  const seasonIds = seasons.map((s) => s.id);
  const yearBySeasonId = new Map(seasons.map((s) => [s.id, s.year]));

  const { data: teams, error: teamsErr } = await supabase.from("teams").select("id, season_id, franchise_id").in("season_id", seasonIds);
  if (teamsErr) throw teamsErr;
  const franchiseIdByTeamId = new Map(teams.map((t) => [t.id, t.franchise_id]));
  const seasonIdByTeamId = new Map(teams.map((t) => [t.id, t.season_id]));
  const teamIds = teams.map((t) => t.id);

  const { data: entries, error: entriesErr } = await supabase
    .from("lineup_entries")
    .select("team_id, week, is_starter, points")
    .in("team_id", teamIds.length > 0 ? teamIds : [""])
    .eq("is_starter", true)
    .eq("points", 0);
  if (entriesErr) throw entriesErr;

  const counts = new Map(); // franchiseId|year -> count
  for (const e of entries ?? []) {
    const franchiseId = franchiseIdByTeamId.get(e.team_id);
    const year = yearBySeasonId.get(seasonIdByTeamId.get(e.team_id));
    if (!franchiseId || year == null) continue;
    const key = `${franchiseId}|${year}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const rows = [...counts.entries()].map(([key, count]) => {
    const [franchiseId, yearStr] = key.split("|");
    return { record_definition_id: defIds.get("franchise_injury_approx_starts"), scope: "season", season_year: Number(yearStr), is_playoff: false, franchise_id: franchiseId, value: count, context: { approximation: true } };
  });
  await replaceResults(defIds.get("franchise_injury_approx_starts"), rows);
  log(`  franchise_injury_approx_starts: ${rows.length} row(s) (approximation)`);

  await recordDataGap(
    "roster",
    "Approximate Injury/Bye Starts counts weeks a starter scored EXACTLY 0 points as a proxy " +
      "for injury/bye/inactive status. No `players`, `lineup_entries`, or `stat_lines` column in " +
      "this schema records an actual injury designation, bye-week flag, or active/inactive " +
      "status for any season — this is a best-effort approximation only.",
    "A healthy player can also score exactly 0 (e.g. a shutout defense, or a kicker who missed " +
      "every attempt), so this record has a real false-positive risk and should be labeled as an " +
      "approximation everywhere it's displayed. Recommend adding a player-status field (captured " +
      "at lineup-lock time, per ESPN's `player.injuryStatus`/BYE indicator) to the stat_lines or a " +
      "new table going forward so this can be computed exactly for future seasons.",
  );
}

async function main() {
  const leagueId = await loadLeagueId();
  const defIds = await upsertDefinitions(leagueId);
  log(`registered ${defIds.size} record_definitions`);

  const seasons = await loadIncludedSeasons();
  if (seasons.length === 0) {
    warn("no included seasons found — nothing to compute");
    return;
  }
  const years = seasons.map((s) => s.year).sort((a, b) => a - b);
  log("included seasons:", years.join(", "));

  const allGames = await loadTeamWeekResults(seasons);

  log("computing all-time records...");
  await computeAndStoreAllTime(defIds, allGames);

  log("computing per-season records...");
  await computeAndStorePerSeason(defIds, allGames, years);

  log("computing franchise records...");
  await computeTransactionActivity(defIds, seasons);
  await computeInjuryApproximation(defIds, seasons);

  log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
