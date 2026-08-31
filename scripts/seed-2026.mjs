// One-off seed for the 2026 season.
//
// Pulls live settings from ESPN, creates the season row, roster slots,
// and scoring rules, then archives the raw payload. Does not create
// teams, matchups, or players — run scripts/sync-espn.mjs after this.
//
// Run with:
//   node --env-file=.env.local scripts/seed-2026.mjs

import { writeFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const LEAGUE_ID = process.env.ESPN_LEAGUE_ID ?? "771894515";
const SWID = process.env.ESPN_SWID;
const S2 = process.env.ESPN_S2;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BASE_URL = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl";
const ARCHIVE_DIR = "data/espn-raw/2026";

function headers() {
  const h = {};
  if (SWID && S2) h.Cookie = `SWID=${SWID}; espn_s2=${S2}`;
  return h;
}

async function espn(year, views) {
  const viewParams = views.map((v) => `view=${v}`).join("&");
  const url = `${BASE_URL}/seasons/${year}/segments/0/leagues/${LEAGUE_ID}?${viewParams}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`ESPN fetch failed: ${res.status} ${res.statusText}`);
  return res.json();
}

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
  23: "FLEX",
  17: "K",
  16: "DST",
  20: "BE",
  21: "IR",
};

const FLEX_POSITIONS = ["RB", "WR", "TE"];
const ALL_POSITIONS = Object.values(ESPN_POSITION_MAP);

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

function eligiblePositionsForSlot(slotCode) {
  if (slotCode === "FLEX") return FLEX_POSITIONS;
  if (slotCode === "BE" || slotCode === "IR") return ALL_POSITIONS;
  return [slotCode];
}

async function main() {
  const { data: league } = await supabase.from("leagues").select("id").maybeSingle();
  if (!league) throw new Error("No league row found.");

  const year = 2026;
  const raw = await espn(year, ["mSettings"]);

  if (!existsSync(ARCHIVE_DIR)) mkdirSync(ARCHIVE_DIR, { recursive: true });
  await writeFile(`${ARCHIVE_DIR}/settings.json`, JSON.stringify(raw, null, 2));

  const settings = raw.settings;
  const schedule = settings.scheduleSettings;
  const roster = settings.rosterSettings;
  const scoring = settings.scoringSettings;

  const { data: existing } = await supabase.from("seasons").select("id").eq("year", year).maybeSingle();
  if (existing) {
    console.log(`Season ${year} already exists (id=${existing.id}). Aborting to avoid overwriting. Delete it manually if you want to re-seed.`);
    process.exit(0);
  }

  const draftType = settings.draftSettings?.type ?? "SNAKE";
  const keeperCount = settings.draftSettings?.keeperCount ?? 0;

  const { data: season, error: seasonErr } = await supabase
    .from("seasons")
    .insert({
      league_id: league.id,
      year,
      espn_league_id: LEAGUE_ID,
      regular_weeks: schedule.matchupPeriodCount,
      playoff_teams: schedule.playoffTeamCount,
      is_locked: false,
      divisions: schedule.divisions.map((d) => ({ name: d.name, size: d.size })),
      playoff_matchup_period_length: schedule.playoffMatchupPeriodLength,
      draft_type: draftType,
      keeper_count: keeperCount,
    })
    .select("id")
    .single();
  if (seasonErr) throw seasonErr;
  const seasonId = season.id;
  console.log(`Created season ${year} (${seasonId})`);

  // Roster slots
  const slotInserts = [];
  let slotOrder = 0;
  for (const [slotId, count] of Object.entries(roster.lineupSlotCounts)) {
    if (count <= 0) continue;
    const slotCode = ESPN_LINEUP_SLOT_MAP[slotId];
    if (!slotCode) {
      console.warn(`Unknown lineup slot id ${slotId}, skipping.`);
      continue;
    }
    slotInserts.push({
      season_id: seasonId,
      slot_code: slotCode,
      count,
      eligible_positions: eligiblePositionsForSlot(slotCode),
      is_starting_slot: slotCode !== "BE" && slotCode !== "IR",
      sort_order: slotOrder++,
    });
  }

  const { error: slotErr } = await supabase.from("roster_slots").insert(slotInserts);
  if (slotErr) throw slotErr;
  console.log(`Inserted ${slotInserts.length} roster slots.`);

  // Scoring rules
  const ruleInserts = [];
  let ruleOrder = 0;
  const unmappedStatIds = [];
  for (const item of scoring.scoringItems) {
    const statKey = ESPN_STAT_ID_TO_KEY[item.statId];
    if (!statKey) {
      unmappedStatIds.push(item.statId);
      continue;
    }
    const overrides = item.pointsOverrides ?? {};
    const overridePositionIds = Object.keys(overrides).map((k) => Number(k));
    const overridePositions = overridePositionIds
      .map((id) => ESPN_POSITION_MAP[id])
      .filter(Boolean);
    const unknownOverrideIds = overridePositionIds.filter((id) => !ESPN_POSITION_MAP[id]);
    for (const id of unknownOverrideIds) {
      console.warn(`Scoring stat ${item.statId} override for unknown position id ${id}, skipping that override.`);
    }

    // Base rule applies to positions not in the overrides.
    let baseFilter = null;
    if (overridePositions.length > 0) {
      baseFilter = ALL_POSITIONS.filter((p) => !overridePositions.includes(p));
    }
    ruleInserts.push({
      season_id: seasonId,
      stat_key: statKey,
      points_per_unit: item.points,
      flat_bonus: 0,
      min_value: null,
      max_value: null,
      position_filter: baseFilter,
      sort_order: ruleOrder,
    });

    for (const posId of overridePositionIds) {
      const pos = ESPN_POSITION_MAP[posId];
      if (!pos) continue;
      ruleInserts.push({
        season_id: seasonId,
        stat_key: statKey,
        points_per_unit: overrides[posId],
        flat_bonus: 0,
        min_value: null,
        max_value: null,
        position_filter: [pos],
        sort_order: ruleOrder,
      });
    }
    ruleOrder += 1;
  }

  if (unmappedStatIds.length > 0) {
    console.warn(`Unmapped ESPN statIds: ${[...new Set(unmappedStatIds)].join(", ")}. Scoring for these was skipped.`);
  }

  const { error: scoringErr } = await supabase.from("scoring_rules").insert(ruleInserts);
  if (scoringErr) throw scoringErr;
  console.log(`Inserted ${ruleInserts.length} scoring rules.`);

  console.log(`\nNext step: node --env-file=.env.local scripts/sync-espn.mjs`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
