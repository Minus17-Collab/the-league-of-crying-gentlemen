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
 * (cwendt94/espn-api, nntrn/espn-wiki) — never guessed.
 *
 * statIds 198 and 209 appear in this league's real scoringItems but
 * are NOT included here: they aren't documented in any public
 * reference, and the commissioner doesn't know what they map to
 * either (confirmed 2026-08-15, see ROADMAP.md). They will surface
 * via `unmappedStatIds` (see normalize.ts) rather than being
 * silently dropped or guessed — see AGENTS.md "When requirements
 * are ambiguous".
 */
export const ESPN_STAT_ID_TO_KEY: Record<number, string> = {
  // Passing
  3: "pass_yd",
  4: "pass_td",
  19: "pass_2pt",
  20: "pass_int",

  // Rushing
  24: "rush_yd",
  25: "rush_td",
  26: "rush_2pt",

  // Receiving
  42: "rec_yd",
  43: "rec_td",
  44: "rec_2pt",
  53: "rec",

  // Fumbles
  63: "fum_rec_td",
  72: "fum_lost",

  // Kicking
  77: "fg_40_49",
  80: "fg_0_39",
  85: "fg_miss",
  86: "xp_made",
  201: "fg_60_plus",

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
  206: "def_2pt_ret",
};

export function mapEspnStatId(statId: number): string | null {
  return ESPN_STAT_ID_TO_KEY[statId] ?? null;
}
