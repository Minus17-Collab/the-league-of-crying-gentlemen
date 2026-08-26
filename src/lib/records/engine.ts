import type {
  RecordHolder,
  SeasonLuck,
  SeasonMargin,
  SeasonTotal,
  StreakResult,
  TeamWeekResult,
  TiedRecord,
  ToughestSchedule,
} from "./types";

/**
 * League records computation (see ROADMAP.md 3.2 / 3.5.1, schema.sql's
 * `record_results` comment). Pure -- no I/O, no database calls, mirrors
 * `lib/scoring/engine.ts` and `lib/grading/draftGrades.ts` in that
 * sense. `scripts/compute-records.mjs` is a plain-JS mirror of this
 * file that does the I/O and writes results into `record_results`.
 *
 * Callers are responsible for building the `TeamWeekResult[]` input
 * with exactly the games that should count -- see that type's doc
 * comment. Every function here just aggregates; none of them decide
 * scope.
 *
 * Ties: every "pick the best" function returns a `TiedRecord`, whose
 * `holders` array contains every franchise tied at the best value.
 * Never break a tie by recency/alphabetical order/etc. -- see AGENTS.md
 * "When requirements are ambiguous" and the records feature's "ties
 * share the record" rule.
 */

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/** Picks every item tied at the best value (max or min), never a
 * single "winner" -- the one seam all tie-handling in this module
 * runs through. */
function tiedBest<T>(
  items: T[],
  value: (item: T) => number,
  direction: "max" | "min",
  toHolder: (item: T) => RecordHolder,
): TiedRecord {
  if (items.length === 0) return { value: 0, holders: [] };
  const best =
    direction === "max"
      ? Math.max(...items.map(value))
      : Math.min(...items.map(value));
  const holders = items.filter((item) => value(item) === best).map(toHolder);
  return { value: best, holders };
}

/** win = 1, tie = 0.5, loss = 0 -- used for both "actual wins" in the
 * all-play luck calc and nowhere else (streaks need the raw
 * win/tie/loss distinction, not a numeric score). */
function resultValue(game: TeamWeekResult): number {
  if (game.points > game.opponentPoints) return 1;
  if (game.points === game.opponentPoints) return 0.5;
  return 0;
}

// ---------------------------------------------------------------
// Single-week extremes (regular season and playoff computed by
// passing different `isPlayoff` filtered subsets in).
// ---------------------------------------------------------------

export function highestSingleWeek(games: TeamWeekResult[]): TiedRecord {
  return tiedBest(games, (g) => g.points, "max", (g) => ({
    franchiseId: g.franchiseId,
    context: { seasonYear: g.seasonYear, week: g.week, opponentFranchiseId: g.opponentFranchiseId },
  }));
}

export function lowestSingleWeek(games: TeamWeekResult[]): TiedRecord {
  return tiedBest(games, (g) => g.points, "min", (g) => ({
    franchiseId: g.franchiseId,
    context: { seasonYear: g.seasonYear, week: g.week, opponentFranchiseId: g.opponentFranchiseId },
  }));
}

// ---------------------------------------------------------------
// Season totals (sum of `points` for a franchise+season; caller
// passes only regular season OR only playoff games to get each
// variant).
// ---------------------------------------------------------------

export function seasonTotals(games: TeamWeekResult[]): SeasonTotal[] {
  const bySeasonFranchise = groupBy(games, (g) => `${g.franchiseId}|${g.seasonYear}`);
  return [...bySeasonFranchise.entries()].map(([key, list]) => {
    const [franchiseId, seasonYearStr] = key.split("|");
    return {
      franchiseId,
      seasonYear: Number(seasonYearStr),
      totalPoints: list.reduce((sum, g) => sum + g.points, 0),
    };
  });
}

export function highestScoringSeason(totals: SeasonTotal[]): TiedRecord {
  return tiedBest(totals, (t) => t.totalPoints, "max", (t) => ({
    franchiseId: t.franchiseId,
    context: { seasonYear: t.seasonYear },
  }));
}

export function lowestScoringSeason(totals: SeasonTotal[]): TiedRecord {
  return tiedBest(totals, (t) => t.totalPoints, "min", (t) => ({
    franchiseId: t.franchiseId,
    context: { seasonYear: t.seasonYear },
  }));
}

// ---------------------------------------------------------------
// Margin of victory / defeat (regular season only, per the prompt --
// pass only regular season games in).
// ---------------------------------------------------------------

export function seasonMargins(games: TeamWeekResult[]): SeasonMargin[] {
  const bySeasonFranchise = groupBy(games, (g) => `${g.franchiseId}|${g.seasonYear}`);
  return [...bySeasonFranchise.entries()].map(([key, list]) => {
    const [franchiseId, seasonYearStr] = key.split("|");
    const wins = list.filter((g) => g.points > g.opponentPoints);
    const losses = list.filter((g) => g.points < g.opponentPoints);
    return {
      franchiseId,
      seasonYear: Number(seasonYearStr),
      avgMarginOfVictory:
        wins.length > 0
          ? wins.reduce((sum, g) => sum + (g.points - g.opponentPoints), 0) / wins.length
          : null,
      avgMarginOfDefeat:
        losses.length > 0
          ? losses.reduce((sum, g) => sum + (g.opponentPoints - g.points), 0) / losses.length
          : null,
    };
  });
}

export function bestAvgMarginOfVictory(margins: SeasonMargin[]): TiedRecord {
  const withValue = margins.filter(
    (m): m is SeasonMargin & { avgMarginOfVictory: number } => m.avgMarginOfVictory != null,
  );
  return tiedBest(withValue, (m) => m.avgMarginOfVictory, "max", (m) => ({
    franchiseId: m.franchiseId,
    context: { seasonYear: m.seasonYear },
  }));
}

export function worstAvgMarginOfDefeat(margins: SeasonMargin[]): TiedRecord {
  const withValue = margins.filter(
    (m): m is SeasonMargin & { avgMarginOfDefeat: number } => m.avgMarginOfDefeat != null,
  );
  return tiedBest(withValue, (m) => m.avgMarginOfDefeat, "max", (m) => ({
    franchiseId: m.franchiseId,
    context: { seasonYear: m.seasonYear },
  }));
}

// ---------------------------------------------------------------
// Win / loss streaks (regular season only). Chronological order is
// (seasonYear asc, week asc) across every season passed in, so a
// caller that wants to allow cross-season streaks just passes games
// from every included season; a caller that wants single-season-only
// streaks passes one season's games at a time. A tie breaks both a
// win streak and a losing streak (it's neither).
// ---------------------------------------------------------------

function longestStreaksPerFranchise(
  games: TeamWeekResult[],
  type: "win" | "loss",
): StreakResult[] {
  const byFranchise = groupBy(games, (g) => g.franchiseId);
  const results: StreakResult[] = [];

  for (const [franchiseId, list] of byFranchise) {
    const sorted = [...list].sort(
      (a, b) => a.seasonYear - b.seasonYear || a.week - b.week,
    );

    let currentLength = 0;
    let currentStart: TeamWeekResult | null = null;
    let best: StreakResult | null = null;

    for (const game of sorted) {
      const matches =
        type === "win" ? game.points > game.opponentPoints : game.points < game.opponentPoints;

      if (matches) {
        if (currentLength === 0) currentStart = game;
        currentLength += 1;
        if (!best || currentLength > best.length) {
          best = {
            franchiseId,
            length: currentLength,
            startSeasonYear: currentStart!.seasonYear,
            startWeek: currentStart!.week,
            endSeasonYear: game.seasonYear,
            endWeek: game.week,
            crossSeason: currentStart!.seasonYear !== game.seasonYear,
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

export function longestWinStreak(games: TeamWeekResult[]): TiedRecord {
  const perFranchise = longestStreaksPerFranchise(games, "win");
  return tiedBest(perFranchise, (s) => s.length, "max", (s) => ({
    franchiseId: s.franchiseId,
    context: {
      startSeasonYear: s.startSeasonYear,
      startWeek: s.startWeek,
      endSeasonYear: s.endSeasonYear,
      endWeek: s.endWeek,
      crossSeason: s.crossSeason,
    },
  }));
}

export function longestLosingStreak(games: TeamWeekResult[]): TiedRecord {
  const perFranchise = longestStreaksPerFranchise(games, "loss");
  return tiedBest(perFranchise, (s) => s.length, "max", (s) => ({
    franchiseId: s.franchiseId,
    context: {
      startSeasonYear: s.startSeasonYear,
      startWeek: s.startWeek,
      endSeasonYear: s.endSeasonYear,
      endWeek: s.endWeek,
      crossSeason: s.crossSeason,
    },
  }));
}

// ---------------------------------------------------------------
// All-play luck (regular season only). Per week, rank each
// franchise's score against every OTHER franchise that played that
// same (seasonYear, week): count how many it outscored (`beatCount`,
// ties = 0.5), out of `fieldSize - 1` possible opponents that week.
// That raw count is NOT directly comparable to a real win (which is
// 1 game out of 1, not 1 game out of fieldSize-1) -- it has to be
// normalized to "equivalent wins" first:
//   wouldBeWinsThatWeek = beatCount / (fieldSize - 1)
// Summed across the season, that is the "expected" win total on the
// SAME 0..numWeeks scale as actual wins, if this franchise's win
// probability each week equaled its share of the full field it beat.
// Compare to actual head-to-head wins (also 1 / 0.5 / 0 for
// win/tie/loss that week):
//   luckGap = actualWins - wouldBeWins
// Luckiest = largest gap; unluckiest = most negative gap.
// `weeklyDetail` on the SeasonLuck result carries every week's raw
// `beatCount`, `fieldSize`, and normalized `wouldBeWinsThatWeek` so
// this can be checked by hand against raw weekly scores without
// re-running anything -- e.g. beatCount=8 with fieldSize=10 (9 other
// teams) means wouldBeWinsThatWeek = 8/9 ≈ 0.889.
//
// Do NOT skip the /(fieldSize-1) normalization: without it, a
// dominant team's raw beatCount (up to fieldSize-1 per week) dwarfs
// its actual win credit (capped at 1 per week regardless of margin),
// which would make every good team look "unlucky" by construction --
// that was a real bug caught by spot-checking a live run of this
// script against actual league data before shipping.
// ---------------------------------------------------------------

export function seasonAllPlayLuck(games: TeamWeekResult[]): SeasonLuck[] {
  const byWeek = groupBy(games, (g) => `${g.seasonYear}|${g.week}`);

  // franchiseId|seasonYear -> { wouldBeWins, weeklyDetail }
  const wouldBeWinsByFranchiseSeason = new Map<
    string,
    { total: number; detail: SeasonLuck["weeklyDetail"] }
  >();

  for (const [weekKey, entries] of byWeek) {
    const [, weekStr] = weekKey.split("|");
    const week = Number(weekStr);
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
    const actualWins = list.reduce((sum, g) => sum + resultValue(g), 0);
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

export function luckiestSeason(luck: SeasonLuck[]): TiedRecord {
  return tiedBest(luck, (l) => l.luckGap, "max", (l) => ({
    franchiseId: l.franchiseId,
    context: { seasonYear: l.seasonYear, actualWins: l.actualWins, wouldBeWins: l.wouldBeWins },
  }));
}

export function unluckiestSeason(luck: SeasonLuck[]): TiedRecord {
  return tiedBest(luck, (l) => l.luckGap, "min", (l) => ({
    franchiseId: l.franchiseId,
    context: { seasonYear: l.seasonYear, actualWins: l.actualWins, wouldBeWins: l.wouldBeWins },
  }));
}

// ---------------------------------------------------------------
// Toughest schedule faced (regular season only): sum, across every
// week a franchise played, of that week's opponent's SEASON-TOTAL
// regular season points (not just that one week's score).
// ---------------------------------------------------------------

export function toughestSchedule(
  games: TeamWeekResult[],
  regularSeasonTotals: SeasonTotal[],
): ToughestSchedule[] {
  const totalByKey = new Map(
    regularSeasonTotals.map((t) => [`${t.franchiseId}|${t.seasonYear}`, t.totalPoints]),
  );

  const bySeasonFranchise = groupBy(games, (g) => `${g.franchiseId}|${g.seasonYear}`);
  return [...bySeasonFranchise.entries()].map(([key, list]) => {
    const [franchiseId, seasonYearStr] = key.split("|");
    const seasonYear = Number(seasonYearStr);
    const opponentPointsSum = list.reduce((sum, g) => {
      const opponentTotal = totalByKey.get(`${g.opponentFranchiseId}|${seasonYear}`) ?? 0;
      return sum + opponentTotal;
    }, 0);
    return { franchiseId, seasonYear, opponentPointsSum };
  });
}

export function toughestScheduleAllTime(list: ToughestSchedule[]): TiedRecord {
  return tiedBest(list, (t) => t.opponentPointsSum, "max", (t) => ({
    franchiseId: t.franchiseId,
    context: { seasonYear: t.seasonYear },
  }));
}
