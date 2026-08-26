/**
 * Shared types for the league records feature (see ROADMAP.md 3.2
 * "Record book" / 3.5.1 "Derived stats", schema.sql's `record_results`
 * comment). Mirrors the plain-data-in/plain-data-out shape of
 * `lib/scoring/types.ts` and `lib/grading/types.ts`.
 */

/**
 * One team's result in one game, from that team's point of view.
 * Exactly one row per franchise per matchup (so a single matchup
 * produces two `TeamWeekResult`s, one per side).
 *
 * Only games that should ever count toward ANY record are represented
 * here at all -- the excluded season (see EXCLUDED_SEASON_YEARS) and
 * both consolation brackets (`playoff_bracket` in
 * `winners_consolation` / `losers_consolation`) are filtered out
 * before this list is built, never inside these functions. That keeps
 * every function below a plain aggregation with no scope-filtering
 * logic to get wrong twice.
 */
export interface TeamWeekResult {
  franchiseId: string;
  seasonYear: number;
  week: number;
  points: number;
  opponentFranchiseId: string;
  opponentPoints: number;
  /** True only for `playoff_bracket = 'winners'` games (the real
   * championship chase) -- see the "Playoff scope" decision in the
   * plan. False means regular season (`is_playoff = false`). */
  isPlayoff: boolean;
}

/** A single value tied to one or more co-holders. Ties are handled by
 * putting every co-holder in `holders`, never by picking one. */
export interface RecordHolder {
  franchiseId: string;
  /** Arbitrary extra fields for this holder's occurrence of the
   * record (week, season, streak span, etc.) -- see each function's
   * doc comment for what it puts here. */
  context: Record<string, unknown>;
}

export interface TiedRecord {
  value: number;
  holders: RecordHolder[];
}

export interface SeasonTotal {
  franchiseId: string;
  seasonYear: number;
  totalPoints: number;
}

export interface SeasonMargin {
  franchiseId: string;
  seasonYear: number;
  /** Average (pointsFor - opponentPoints) across games this franchise
   * won. Null if the franchise had zero wins that season. */
  avgMarginOfVictory: number | null;
  /** Average (opponentPoints - pointsFor) across games this franchise
   * lost. Null if the franchise had zero losses that season. */
  avgMarginOfDefeat: number | null;
}

export interface StreakResult {
  franchiseId: string;
  length: number;
  startSeasonYear: number;
  startWeek: number;
  endSeasonYear: number;
  endWeek: number;
  /** True if the streak's games span more than one season -- only
   * possible for franchises with more than one included season. */
  crossSeason: boolean;
}

export interface SeasonLuck {
  franchiseId: string;
  seasonYear: number;
  actualWins: number;
  /** Sum, across every week that season, of how many other franchises
   * this one outscored that week (ties count as 0.5) -- the
   * "all-play" expected win total. See `seasonAllPlayLuck`'s doc
   * comment for the full method and how to spot-check it. */
  wouldBeWins: number;
  /** actualWins - wouldBeWins. Positive = lucky (won more than the
   * full field's scores suggest they "should" have); negative =
   * unlucky. See `seasonAllPlayLuck`'s doc comment in engine.ts for
   * the normalization this depends on. */
  luckGap: number;
  weeklyDetail: {
    week: number;
    /** Raw count of other franchises outscored that week (ties = 0.5),
     * out of `fieldSize - 1` possible. */
    beatCount: number;
    fieldSize: number;
    /** beatCount / (fieldSize - 1) -- normalized to the same 0..1
     * per-week scale as an actual win, so it's comparable to actual
     * wins when summed across the season. */
    wouldBeWinsThatWeek: number;
  }[];
}

export interface ToughestSchedule {
  franchiseId: string;
  seasonYear: number;
  /** Sum of each week's opponent's season-total regular-season points
   * (not that single week's opponent score) -- see the prompt's
   * "Toughest Schedule Faced" definition. */
  opponentPointsSum: number;
}
