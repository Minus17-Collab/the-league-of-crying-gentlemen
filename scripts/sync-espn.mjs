// Weekly ESPN sync job.
//
// This is the first real ingestion pass. It currently ingests:
//   - teams (per season, resolved to franchises by ESPN owner GUID)
//   - matchups (current week + the two prior weeks, to absorb stat corrections)
//
// It deliberately does not yet write rosters, stat lines, or transactions —
// those are the next slices. It is idempotent by deleting matchups for the
// target weeks and re-inserting (season must not be locked).
//
// Run with:
//   node --env-file=.env.local scripts/sync-espn.mjs

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

async function syncRosters(seasonId, year, weeks, teamIdByExternal) {
  const seasonTeamIds = [...teamIdByExternal.values()];

  for (const week of weeks) {
    const league = await espnForWeek(year, week, "mRoster");
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
          points: null,
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

    await logRun({
      status: "success",
      scope: "matchups",
      seasonId,
      week: currentWeek,
      message: `Ingested ${upsertedTeams?.length ?? 0} teams and ${matchupInserts.length} matchups for weeks ${weeks.join(", ")}.`,
    });

    await syncRosters(seasonId, year, weeks, teamIdByExternal);

    console.log(
      `Sync ok: ${upsertedTeams?.length ?? 0} teams, ${matchupInserts.length} matchups and rosters for weeks ${weeks.join(", ")}.`,
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
