// Weekly ESPN sync job.
//
// This is the live ESPN ingestion job. It ingests:
//   - teams (per season, resolved to franchises by ESPN owner GUID)
//   - matchups (current week + the two prior weeks, to absorb stat corrections)
//   - rosters and player identity for each target week
//
// It also archives the raw ESPN JSON payloads to data/espn-raw/{year}/ for
// debugging and replay. It does not yet write stat lines or transactions.
// It is idempotent by deleting target weeks and re-inserting (season must
// not be locked).
//
// Run with:
//   node --env-file=.env.local scripts/sync-espn.mjs

import { createClient } from "@supabase/supabase-js";
import { writeFile, mkdir } from "node:fs/promises";

const LEAGUE_ID = process.env.ESPN_LEAGUE_ID ?? "771894515";
const ARCHIVE_DIR = "data/espn-raw";
const SWID = process.env.ESPN_SWID;
const S2 = process.env.ESPN_S2;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BASE_URL = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl";

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

function mapStatKey(id) {
  return ESPN_STAT_ID_TO_KEY[id] ?? null;
}

async function archive(year, name, data) {
  const dir = `${ARCHIVE_DIR}/${year}`;
  await mkdir(dir, { recursive: true });
  const file = `${dir}/${new Date().toISOString().replace(/[:.]/g, "-")}-${name}.json`;
  await writeFile(file, JSON.stringify(data, null, 2));
}

function headers() {
  const h = {};
  if (SWID && S2) {
    h.Cookie = `SWID=${SWID}; espn_s2=${S2}`;
  }
  return h;
}

async function espn(year, views, preferHistorical = false) {
  const viewParams = views.map((v) => `view=${v}`).join("&");
  const current = `${BASE_URL}/seasons/${year}/segments/0/leagues/${LEAGUE_ID}?${viewParams}`;
  const historical = `${BASE_URL}/leagueHistory/${LEAGUE_ID}?seasonId=${year}&${viewParams}`;
  const first = preferHistorical ? historical : current;
  const second = preferHistorical ? current : historical;

  let res = await fetch(first, { headers: headers() });
  if (!res.ok) {
    res = await fetch(second, { headers: headers() });
  }
  if (!res.ok) {
    throw new Error(`ESPN fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function unwrapHistory(raw) {
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

function getTeams(league) {
  return (league.teams ?? []).map((t) => ({
    externalTeamId: String(t.id),
    name:
      t.name ??
      [t.location, t.nickname].filter(Boolean).join(" ").trim() ??
      `Team ${t.id}`,
    abbreviation: t.abbrev ?? null,
    logoUrl: t.logo ?? null,
    owners: Array.isArray(t.owners) ? t.owners : [],
    draftDayProjectedRank: t.draftDayProjectedRank ?? null,
  }));
}

function mapPlayoffTier(tierType) {
  switch (tierType) {
    case "WINNERS_BRACKET":
    case "WINNERS_BRACKET_CHAMPIONSHIP":
      return "winners";
    case "WINNERS_CONSOLATION_LADDER":
      return "winners_consolation";
    case "LOSERS_CONSOLATION_LADDER":
      return "losers_consolation";
    default:
      return null;
  }
}

function getMatchups(league) {
  const out = (league.schedule ?? [])
    .filter((m) => m.home?.teamId !== undefined && m.away?.teamId !== undefined)
    .map((m) => ({
      week: m.matchupPeriodId,
      homeExternalTeamId: String(m.home.teamId),
      awayExternalTeamId: String(m.away.teamId),
      homeScore: m.home.totalPoints ?? null,
      awayScore: m.away.totalPoints ?? null,
      playoffBracket: mapPlayoffTier(m.playoffTierType),
      isPlayoff: mapPlayoffTier(m.playoffTierType) !== null,
      isFinal: m.winner !== undefined && m.winner !== "UNDECIDED",
    }));

  const lastWinnersWeek = Math.max(
    -Infinity,
    ...out.filter((m) => m.playoffBracket === "winners").map((m) => m.week),
  );
  for (const m of out) {
    if (m.playoffBracket === "winners" && m.week === lastWinnersWeek) {
      m.isChampionship = true;
    } else {
      m.isChampionship = false;
    }
  }
  return out;
}

function fmtIso() {
  return new Date().toISOString();
}

async function espnForWeek(year, week, view) {
  const url = `${BASE_URL}/seasons/${year}/segments/0/leagues/${LEAGUE_ID}?scoringPeriodId=${week}&view=${view}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`ESPN fetch failed: ${res.status} ${res.statusText}`);
  return res.json();
}

function mapPosition(id) {
  return ESPN_POSITION_MAP[id] ?? "UNKNOWN";
}

function mapSlot(id) {
  return ESPN_LINEUP_SLOT_MAP[id] ?? null;
}

function pointsFromEntry(entry, week) {
  const stats = entry.playerPoolEntry?.player?.stats;
  if (!Array.isArray(stats)) return null;
  const actual = stats.find((s) => s.scoringPeriodId === week && s.statSourceId === 0);
  return actual?.appliedTotal ?? null;
}

async function syncRosters(seasonId, year, weeks, teamIdByExternal) {
  const seasonTeamIds = [...teamIdByExternal.values()];

  for (const week of weeks) {
    const league = await espnForWeek(year, week, "mRoster");
    await archive(year, `rosters-week-${week}`, league);

    const teamRosters = (league.teams ?? []).map((t) => ({
      externalTeamId: String(t.id),
      entries: (t.roster?.entries ?? []).map((e) => ({
        playerId: String(e.playerId),
        slotId: e.lineupSlotId,
        fullName: e.playerPoolEntry?.player?.fullName ?? `Player ${e.playerId}`,
        positionId: e.playerPoolEntry?.player?.defaultPositionId,
        proTeamId: e.playerPoolEntry?.player?.proTeamId ?? null,
      })),
    }));

    const playerByExternal = new Map();
    const allPlayerIds = [...new Set(teamRosters.flatMap((t) => t.entries.map((e) => e.playerId)))];

    if (allPlayerIds.length > 0) {
      const { data: existingIds, error: idErr } = await supabase
        .from("player_external_ids")
        .select("player_id, external_id")
        .eq("provider", "espn")
        .in("external_id", allPlayerIds);
      if (idErr) throw idErr;

      const missingIds = allPlayerIds.filter((id) => !existingIds?.some((r) => r.external_id === id));
      const { data: existingPlayers, error: playerErr } = await supabase
        .from("players")
        .select("id, full_name, position, nfl_team")
        .in("id", (existingIds ?? []).map((r) => r.player_id));
      if (playerErr) throw playerErr;

      for (const p of existingPlayers ?? []) {
        const ext = existingIds?.find((r) => r.player_id === p.id);
        if (ext) playerByExternal.set(ext.external_id, p.id);
      }

      const playersToInsert = missingIds.map((id) => {
        const entry = teamRosters
          .flatMap((t) => t.entries)
          .find((e) => e.playerId === id);
        return {
          full_name: entry?.fullName ?? `Player ${id}`,
          position: mapPosition(entry?.positionId),
          nfl_team: entry?.proTeamId !== null ? String(entry.proTeamId) : null,
        };
      });

      if (playersToInsert.length > 0) {
        const { data: insertedPlayers, error: insertErr } = await supabase
          .from("players")
          .insert(playersToInsert)
          .select("id, full_name");
        if (insertErr) throw insertErr;

        const extToInsert = (insertedPlayers ?? []).map((p, i) => ({
          player_id: p.id,
          provider: "espn",
          external_id: missingIds[i],
        }));
        const { error: extInsertErr } = await supabase.from("player_external_ids").insert(extToInsert);
        if (extInsertErr) throw extInsertErr;

        for (let i = 0; i < (insertedPlayers ?? []).length; i++) {
          playerByExternal.set(missingIds[i], insertedPlayers[i].id);
        }
      }

      for (const r of existingIds ?? []) {
        playerByExternal.set(r.external_id, r.player_id);
      }
    }

    // Wipe and re-insert this week's lineup entries for the season's teams.
    const { error: deleteErr } = await supabase
      .from("lineup_entries")
      .delete()
      .in("team_id", seasonTeamIds)
      .eq("week", week);
    if (deleteErr) throw deleteErr;

    const lineupInserts = [];
    for (const t of teamRosters) {
      const teamId = teamIdByExternal.get(t.externalTeamId);
      if (!teamId) continue;
      for (const e of t.entries) {
        const playerId = playerByExternal.get(e.playerId);
        if (!playerId) {
          console.warn(`Could not resolve player ${e.playerId} for team ${t.externalTeamId} week ${week}`);
          continue;
        }
        const slotCode = mapSlot(e.slotId);
        if (!slotCode) {
          console.warn(`Unknown lineup slot ${e.slotId} for player ${e.playerId}`);
          continue;
        }
        lineupInserts.push({
          team_id: teamId,
          week,
          player_id: playerId,
          slot_code: slotCode,
          is_starter: slotCode !== "BE" && slotCode !== "IR",
          points: pointsFromEntry(e, week),
        });
      }
    }

    if (lineupInserts.length > 0) {
      const { error: insertErr } = await supabase.from("lineup_entries").insert(lineupInserts);
      if (insertErr) throw insertErr;
    }

    console.log(`Ingested ${lineupInserts.length} lineup entries for week ${week}.`);
  }
}

function allBoxscoreRosterEntries(league) {
  return (league.schedule ?? []).flatMap((m) => [
    ...(m.home?.rosterForCurrentScoringPeriod?.entries ?? []),
    ...(m.away?.rosterForCurrentScoringPeriod?.entries ?? []),
  ]);
}

async function syncStatLines(seasonId, year, weeks) {
  const league = await espn(year, ["mBoxscore"], false);
  await archive(year, "boxscore", league);

  const statsByWeek = new Map();
  for (const week of weeks) {
    statsByWeek.set(week, new Map());
  }

  const seenExternalIds = new Set();
  for (const entry of allBoxscoreRosterEntries(league)) {
    const player = entry.playerPoolEntry?.player;
    if (!player) continue;
    const playerId = String(entry.playerId);
    const weekStats = player.stats?.find((s) => weeks.includes(s.scoringPeriodId) && s.statSourceId === 0);
    if (!weekStats) continue;

    seenExternalIds.add(playerId);
    const map = statsByWeek.get(weekStats.scoringPeriodId);
    if (!map) continue;
    map.set(playerId, { externalId: playerId, stats: weekStats.stats, appliedTotal: weekStats.appliedTotal });
  }

  if (seenExternalIds.size === 0) {
    console.log(`No actual stat lines available for weeks ${weeks.join(", ")} yet.`);
    return;
  }

  const { data: existingIds, error: idErr } = await supabase
    .from("player_external_ids")
    .select("player_id, external_id")
    .eq("provider", "espn")
    .in("external_id", [...seenExternalIds]);
  if (idErr) throw idErr;
  const playerByExternal = new Map((existingIds ?? []).map((r) => [r.external_id, r.player_id]));

  const statInserts = [];
  for (const [week, map] of statsByWeek) {
    for (const row of map.values()) {
      const playerId = playerByExternal.get(row.externalId);
      if (!playerId) {
        console.warn(`No player_id for ESPN id ${row.externalId} during stat line sync.`);
        continue;
      }
      for (const [statIdRaw, value] of Object.entries(row.stats)) {
        const statId = Number(statIdRaw);
        const statKey = mapStatKey(statId);
        if (!statKey) continue;
        statInserts.push({
          player_id: playerId,
          year,
          week,
          stat_key: statKey,
          value,
          source: "espn",
        });
      }
    }
  }

  if (statInserts.length > 0) {
    const { error: upsertErr } = await supabase
      .from("stat_lines")
      .upsert(statInserts, { onConflict: "player_id, year, week, stat_key" });
    if (upsertErr) throw upsertErr;
    console.log(`Upserted ${statInserts.length} stat lines for weeks ${weeks.join(", ")}.`);
  }
}

function mapTransactionType(transaction) {
  if (transaction.type === "DRAFT") return null;
  const itemTypes = (transaction.items ?? []).map((i) => (i.type ?? "").toUpperCase());
  if (itemTypes.length === 0) return null;
  if (itemTypes.every((t) => t === "LINEUP")) return null;
  if (itemTypes.includes("TRADE")) return "trade";
  if (itemTypes.includes("WAIVER")) return "waiver";
  if (itemTypes.some((t) => t.includes("DROP"))) return "drop";
  return "add";
}

async function syncTransactions(seasonId, year, teamIdByExternal) {
  const league = await espn(year, ["mTransactions2"], false);
  await archive(year, "transactions", league);

  const inserts = [];
  for (const t of league.transactions ?? []) {
    const type = mapTransactionType(t);
    if (!type) continue;
    if (t.isPending || t.status !== "EXECUTED") continue;

    const teamId = t.teamId != null ? teamIdByExternal.get(String(t.teamId)) : null;
    const counterpartyId = (t.items ?? []).find((i) => i.fromTeamId != null && i.fromTeamId !== 0)
      ? teamIdByExternal.get(String(t.items.find((i) => i.fromTeamId != null && i.fromTeamId !== 0).fromTeamId))
      : null;

    inserts.push({
      season_id: seasonId,
      week: t.scoringPeriodId ?? null,
      type,
      team_id: teamId ?? null,
      counterparty_team_id: type === "trade" && counterpartyId ? counterpartyId : null,
      faab_spent: t.bidAmount != null && t.bidAmount > 0 ? t.bidAmount : null,
      occurred_at: t.proposedDate ? new Date(t.proposedDate).toISOString() : new Date().toISOString(),
      details: { transactionId: t.id, items: t.items },
    });
  }

  const { error: deleteErr } = await supabase.from("transactions").delete().eq("season_id", seasonId);
  if (deleteErr) throw deleteErr;

  if (inserts.length > 0) {
    const { error: insertErr } = await supabase.from("transactions").insert(inserts);
    if (insertErr) throw insertErr;
  }

  console.log(`Ingested ${inserts.length} transactions for ${year}.`);
}

async function updateTeamRecords(seasonId) {
  const { data: matchups, error } = await supabase
    .from("matchups")
    .select("home_team_id, away_team_id, home_score, away_score")
    .eq("season_id", seasonId)
    .eq("is_playoff", false);
  if (error) throw error;

  const stats = new Map();
  function ensure(teamId) {
    if (!stats.has(teamId)) {
      stats.set(teamId, { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 });
    }
    return stats.get(teamId);
  }

  for (const m of matchups ?? []) {
    if (m.home_score == null || m.away_score == null) continue;
    const home = ensure(m.home_team_id);
    const away = ensure(m.away_team_id);

    home.pointsFor += m.home_score;
    home.pointsAgainst += m.away_score;
    away.pointsFor += m.away_score;
    away.pointsAgainst += m.home_score;

    if (m.home_score > m.away_score) {
      home.wins += 1;
      away.losses += 1;
    } else if (m.away_score > m.home_score) {
      away.wins += 1;
      home.losses += 1;
    } else {
      home.ties += 1;
      away.ties += 1;
    }
  }

  const updates = [...stats.entries()].map(([id, s]) => ({
    id,
    points_for: s.pointsFor,
    points_against: s.pointsAgainst,
    wins: s.wins,
    losses: s.losses,
    ties: s.ties,
  }));

  for (const u of updates) {
    const { error: updateErr } = await supabase
      .from("teams")
      .update({
        points_for: u.points_for,
        points_against: u.points_against,
        wins: u.wins,
        losses: u.losses,
        ties: u.ties,
      })
      .eq("id", u.id);
    if (updateErr) throw updateErr;
  }

  if (updates.length > 0) {
    console.log(`Updated team records for ${updates.length} teams.`);
  }
}

async function logRun({ status, scope, seasonId, week, message }) {
  const startedAt = fmtIso();
  await supabase.from("sync_runs").insert({
    provider: "espn",
    scope,
    season_id: seasonId,
    week,
    status,
    message,
    started_at: startedAt,
    finished_at: fmtIso(),
  });
}

async function main() {
  const year = new Date().getFullYear();

  try {
    const settings = unwrapHistory(await espn(year, ["mSettings"], false));
    const currentWeek = settings.status?.currentMatchupPeriod ?? null;
    if (!currentWeek) {
      throw new Error("Could not determine current matchup period from ESPN settings.");
    }

    const { data: season, error: seasonErr } = await supabase
      .from("seasons")
      .select("id, year, is_locked")
      .eq("year", year)
      .maybeSingle();
    if (seasonErr) throw seasonErr;
    if (!season) {
      throw new Error(`Season ${year} not found in the database. Create it before syncing.`);
    }
    if (season.is_locked) {
      throw new Error(`Season ${year} is locked and will not be mutated.`);
    }

    const seasonId = season.id;

    const league = unwrapHistory(await espn(year, ["mTeam", "mMatchup"], year < new Date().getFullYear()));
    await archive(year, "team-matchup", league);

    const normalizedTeams = getTeams(league);
    const normalizedMatchups = getMatchups(league);

    // Resolve franchises by ESPN owner GUID. A team with no matching franchise is a hard error.
    const { data: franchises, error: franchisesErr } = await supabase
      .from("franchises")
      .select("id, espn_owner_ids");
    if (franchisesErr) throw franchisesErr;

    const franchiseByOwner = new Map();
    for (const f of franchises ?? []) {
      for (const guid of f.espn_owner_ids) {
        franchiseByOwner.set(guid, f.id);
      }
    }

    const franchiseByTeam = new Map();
    for (const t of normalizedTeams) {
      const matchingGuid = t.owners.find((guid) => franchiseByOwner.has(guid));
      if (!matchingGuid) {
        throw new Error(
          `No franchise found for ESPN owner GUIDs ${JSON.stringify(t.owners)} (team ${t.externalTeamId} "${t.name}"). Add the franchise before syncing.`,
        );
      }
      franchiseByTeam.set(t.externalTeamId, franchiseByOwner.get(matchingGuid));
    }

    // Upsert teams (one per franchise per season).
    const { data: existingTeams, error: existingTeamsErr } = await supabase
      .from("teams")
      .select("id, franchise_id, espn_team_id")
      .eq("season_id", seasonId);
    if (existingTeamsErr) throw existingTeamsErr;

    const teamIdByFranchise = new Map((existingTeams ?? []).map((t) => [t.franchise_id, t.id]));
    const teamInserts = [];
    for (const t of normalizedTeams) {
      const franchiseId = franchiseByTeam.get(t.externalTeamId);
      const existingId = teamIdByFranchise.get(franchiseId);
      teamInserts.push({
        ...(existingId ? { id: existingId } : {}),
        season_id: seasonId,
        franchise_id: franchiseId,
        name: t.name,
        abbreviation: t.abbreviation,
        logo_url: t.logoUrl,
        espn_team_id: t.externalTeamId,
        draft_slot: t.draftDayProjectedRank,
      });
    }

    const { data: upsertedTeams, error: teamsErr } = await supabase
      .from("teams")
      .upsert(teamInserts, { onConflict: "season_id, franchise_id" })
      .select("id, franchise_id, espn_team_id");
    if (teamsErr) throw teamsErr;

    const teamIdByExternal = new Map((upsertedTeams ?? []).map((t) => [t.espn_team_id, t.id]));

    // Re-sync current week plus two prior weeks to absorb stat corrections.
    const weeks = [currentWeek, currentWeek - 1, currentWeek - 2].filter((w) => w >= 1);
    const { error: deleteMatchupsErr } = await supabase
      .from("matchups")
      .delete()
      .eq("season_id", seasonId)
      .in("week", weeks);
    if (deleteMatchupsErr) throw deleteMatchupsErr;

    const matchupsForTargetWeeks = normalizedMatchups.filter((m) => weeks.includes(m.week));
    const matchupInserts = matchupsForTargetWeeks.map((m) => ({
      season_id: seasonId,
      week: m.week,
      home_team_id: teamIdByExternal.get(m.homeExternalTeamId),
      away_team_id: teamIdByExternal.get(m.awayExternalTeamId),
      home_score: m.homeScore,
      away_score: m.awayScore,
      is_playoff: m.isPlayoff,
      is_championship: m.isChampionship,
      is_final: m.isFinal,
      playoff_bracket: m.playoffBracket,
    }));

    const { error: matchupsErr } = await supabase.from("matchups").insert(matchupInserts);
    if (matchupsErr) throw matchupsErr;

    await updateTeamRecords(seasonId);

    await logRun({
      status: "success",
      scope: "matchups",
      seasonId,
      week: currentWeek,
      message: `Ingested ${upsertedTeams?.length ?? 0} teams and ${matchupInserts.length} matchups for weeks ${weeks.join(", ")}.`,
    });

    await syncRosters(seasonId, year, weeks, teamIdByExternal);
    await syncStatLines(seasonId, year, weeks);
    await syncTransactions(seasonId, year, teamIdByExternal);

    console.log(
      `Sync ok: ${upsertedTeams?.length ?? 0} teams, ${matchupInserts.length} matchups, rosters, stat lines, and transactions for ${year}.`,
    );
  } catch (err) {
    await logRun({
      status: "failed",
      scope: "matchups",
      seasonId: null,
      week: null,
      message: err.message,
    });
    console.error("Sync failed:", err);
    process.exit(1);
  }
}

main();
