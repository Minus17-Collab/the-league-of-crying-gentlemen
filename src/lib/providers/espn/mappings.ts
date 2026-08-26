/**
 * ESPN uses proprietary numeric IDs for positions, lineup slots, and
 * stat categories. Position and lineup-slot IDs are stable and
 * well-documented by the fantasy-football community; stat IDs vary
 * more and MUST be cross-checked against this league's real
 * `mSettings` response before trusting them (see AGENTS.md "Never
 * do this: hardcode a point value" — a wrong statId mapping is
 * equivalent to a wrong point value).
 */

/** ESPN defaultPositionId -> this codebase's position vocabulary. */
export const ESPN_POSITION_MAP: Record<number, string> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "DST",
};

/** ESPN lineupSlotId -> this codebase's roster_slots.slot_code vocabulary. */
export const ESPN_LINEUP_SLOT_MAP: Record<number, string> = {
  0: "QB",
  2: "RB",
  4: "WR",
  6: "TE",
  23: "FLEX",
  17: "K",
  16: "DST",
  20: "BE",
  21: "IR",
};

export function mapEspnPosition(positionId: number | undefined): string | null {
  if (positionId === undefined) return null;
  return ESPN_POSITION_MAP[positionId] ?? null;
}

export function mapEspnLineupSlot(slotId: number): string | null {
  return ESPN_LINEUP_SLOT_MAP[slotId] ?? null;
}

/**
 * ESPN scoringItems statId -> this league's stat_categories.key.
 *
 * Populated from this league's real `mSettings` response (see
 * data/history/scoring-by-season.json, pulled 2026-08-15) and
 * cross-checked against public ESPN API stat-ID references
 * (cwendt94/espn-api `constant.py` SETTINGS_SCORING_FORMAT_MAP,
 * nntrn/espn-wiki) — never guessed.
 *
 * All statIds that appear in this league's real 2023-2025
 * scoringItems are now mapped, INCLUDING 198 ("FG Made 50-59 yards"),
 * 209 ("1pt Safety"), and 214 ("FG Made Yards" — per-yard bonus on
 * made field goals) — these were previously left unmapped pending
 * investigation (see ROADMAP.md), and were identified 2026-08-16 by
 * cross-referencing cwendt94/espn-api's SETTINGS_SCORING_FORMAT_MAP,
 * which documents labels for statIds up to 234, not just the
 * PLAYER_STATS_MAP subset used elsewhere in that project.
 *
 * On pointsOverrides: nearly every D/ST-related stat in this league's
 * real scoring config (points-allowed bands, yards-allowed bands,
 * defensive TDs/sacks/tackles/return yards, 1pt/2pt safety returns,
 * etc.) stores its real point value in a SINGLE override keyed "16"
 * (16 = D/ST, matching ESPN_POSITION_MAP above) rather than in the
 * base `points` field. That pattern is unambiguous and is resolved
 * automatically wherever this map is consumed (see
 * `scripts/backfill-supabase.mjs`'s `resolveStatPoints`).
 *
 * NOT resolved: this league's 2023 scoring config carries MULTI-key
 * `pointsOverrides` on rush yardage/TD stats (statIds 24, 25, 26, 35,
 * 36, 37, 38) keyed "1","2","3","4","15" — integers that do NOT match
 * either ESPN's lineupSlotId or defaultPositionId vocabularies used
 * elsewhere in this codebase. This looks like a position- or
 * roster-slot-based bonus scheme unique to the 2023 season, but which
 * integers map to which position could not be confirmed from public
 * references or this league's other data. Needs commissioner
 * confirmation before being modeled — see AGENTS.md "When
 * requirements are ambiguous". The base (non-override) `points`
 * value for these stats (0 for all seven in 2023) IS used as a
 * fallback wherever this map is consumed.
 */
export const ESPN_STAT_ID_TO_KEY: Record<number, string> = {
  // Passing
  3: "pass_yd",
  4: "pass_td",
  15: "pass_td_40_plus",
  16: "pass_td_50_plus",
  17: "pass_yd_300_399",
  18: "pass_yd_400_plus",
  19: "pass_2pt",
  20: "pass_int",
  64: "pass_sacked",

  // Rushing
  24: "rush_yd",
  25: "rush_td",
  26: "rush_2pt",
  35: "rush_td_40_plus",
  36: "rush_td_50_plus",
  37: "rush_yd_100_199",
  38: "rush_yd_200_plus",

  // Receiving
  42: "rec_yd",
  43: "rec_td",
  44: "rec_2pt",
  45: "rec_td_40_plus",
  46: "rec_td_50_plus",
  53: "rec",
  56: "rec_yd_100_199",
  57: "rec_yd_200_plus",
  58: "rec_target",

  // Fumbles
  63: "fum_rec_td",
  72: "fum_lost",

  // Kicking
  77: "fg_40_49",
  80: "fg_0_39",
  83: "fg_made",
  85: "fg_miss",
  86: "xp_made",
  88: "xp_missed",
  198: "fg_50_59",
  201: "fg_60_plus",
  214: "fg_made_yards",

  // Defense/Special Teams — points allowed bands
  89: "def_pa_0",
  90: "def_pa_1_6",
  91: "def_pa_7_13",
  92: "def_pa_14_17",
  123: "def_pa_28_34",
  124: "def_pa_35_45",
  125: "def_pa_46_plus",

  // Defense/Special Teams — yards allowed bands
  128: "def_yds_lt100",
  129: "def_yds_100_199",
  130: "def_yds_200_299",
  132: "def_yds_350_399",
  133: "def_yds_400_449",
  134: "def_yds_450_499",
  135: "def_yds_500_549",
  136: "def_yds_550_plus",

  // Defense/Special Teams — plays
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

export function mapEspnStatId(statId: number): string | null {
  return ESPN_STAT_ID_TO_KEY[statId] ?? null;
}
