import type {
  DraftNightResult,
  GradablePick,
  RegradeResult,
} from "./types";

/**
 * Draft pick grading (see AGENTS.md Phase 3.5.2 / ROADMAP.md "Draft
 * grading" and `schema.sql`'s `draft_pick_grades` comment). Pure —
 * no I/O, no database calls, mirrors `lib/scoring/engine.ts`.
 *
 * Two independent gradings share this module:
 *
 * 1. End-of-season Regrade (uncurved, VOE-based): needs only this
 *    league's own `draft_picks` + season points. Expected points per
 *    pick come from a "pooled pick-slot decay curve" — the average
 *    season points scored by all players taken in the same round,
 *    pooled across every locked season, smoothed into a strictly
 *    non-increasing curve (later rounds can never have a higher
 *    expected value than earlier ones) via isotonic regression
 *    (pool-adjacent-violators). `regrade_grade` bands are fixed VOE
 *    point thresholds, applied identically across all seasons (never
 *    curved), because VOE is already directly comparable in points
 *    across seasons.
 *
 * 2. Draft Night Grade (curved, ADP-based): needs external preseason
 *    ADP (see scripts/fetch-historical-adp.mjs). `draft_night_grade`
 *    IS curved — a percentile rank of `reach_value` within that
 *    season's draft class — because raw reach values aren't
 *    comparable across draft classes of different sizes/ADP sources.
 *
 * Picks with missing inputs (no season points, or no matched ADP)
 * produce null outputs for the fields that depend on that input,
 * never a guessed value (see AGENTS.md "When requirements are
 * ambiguous").
 */

// Fixed VOE bands for the Regrade, in fantasy points above/below
// expectation. Not curved — see module doc comment. Tune here if the
// commissioner wants different bands; there is no established
// precedent in this codebase to match.
const REGRADE_BANDS: { min: number; grade: string }[] = [
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

// Percentile cutoffs (of reach_value, within one season's draft class)
// used to curve the Draft Night Grade. `min` is the minimum percentile
// (0-1) required for that grade.
const DRAFT_NIGHT_PERCENTILE_BANDS: { min: number; grade: string }[] = [
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

function bandFor(value: number, bands: { min: number; grade: string }[]): string {
  for (const band of bands) {
    if (value >= band.min) return band.grade;
  }
  return bands[bands.length - 1].grade;
}

/**
 * Pooled, isotonic-smoothed expected points per round, computed from
 * every pick passed in (callers should pass only locked seasons' picks
 * — see AGENTS.md "Seasons are immutable once locked"). Picks with a
 * null `seasonPoints` are excluded from the average for their round.
 */
export function computeExpectedPointsByRound(
  picks: GradablePick[],
): Map<number, number> {
  const rounds = [...new Set(picks.map((p) => p.round))].sort((a, b) => a - b);

  const byRound = new Map<number, { total: number; count: number }>();
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

  const result = new Map<number, number>();
  smoothed.forEach((value, idx) => result.set(averages[idx].round, value));
  return result;
}

/** Proper PAVA over ordered (round) entries, non-increasing target. */
export function poolAdjacentViolatorsNonIncreasing(
  entries: { round: number; value: number; weight: number }[],
): number[] {
  type Block = { value: number; weight: number; count: number };
  const blocks: Block[] = entries.map((e) => ({
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
      const merged: Block = {
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

  const flat: number[] = [];
  for (const block of blocks) {
    for (let k = 0; k < block.count; k += 1) flat.push(block.value);
  }
  return flat;
}

/**
 * End-of-season Regrade for a set of picks. `picks` should be every
 * graded pick from every locked season (used to build the pooled
 * expected-points curve); `regrade_rank` is computed within each
 * pick's own `seasonId`.
 */
export function computeRegrade(picks: GradablePick[]): RegradeResult[] {
  const expectedByRound = computeExpectedPointsByRound(picks);

  const withVoe = picks.map((pick) => {
    const expectedPoints = expectedByRound.get(pick.round) ?? null;
    const voe =
      pick.seasonPoints != null && expectedPoints != null
        ? pick.seasonPoints - expectedPoints
        : null;
    return { pick, expectedPoints, voe };
  });

  const rankBySeason = new Map<string, { draftPickId: string; voe: number }[]>();
  for (const entry of withVoe) {
    if (entry.voe == null) continue;
    const list = rankBySeason.get(entry.pick.seasonId) ?? [];
    list.push({ draftPickId: entry.pick.draftPickId, voe: entry.voe });
    rankBySeason.set(entry.pick.seasonId, list);
  }
  const rankByPickId = new Map<string, number>();
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

/**
 * Draft Night Grade for a set of picks, curved within each pick's own
 * `seasonId` (a draft class). Picks with no matched ADP get null
 * `reachValue`/`draftNightGrade` and are excluded from other picks'
 * percentile calculation in that season.
 */
export function computeDraftNightGrade(picks: GradablePick[]): DraftNightResult[] {
  const withReach = picks.map((pick) => ({
    pick,
    reachValue: pick.adpAtPick != null ? pick.overallPick - pick.adpAtPick : null,
  }));

  const bySeasonSorted = new Map<string, number[]>();
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

/** Fraction of `sorted` strictly less than `value`, plus half the ties,
 * i.e. the standard mid-rank percentile. `sorted` must already be
 * ascending. */
function percentileRank(sorted: number[], value: number): number {
  if (sorted.length <= 1) return 0.5;
  let below = 0;
  let equal = 0;
  for (const v of sorted) {
    if (v < value) below += 1;
    else if (v === value) equal += 1;
  }
  return (below + equal / 2) / sorted.length;
}
