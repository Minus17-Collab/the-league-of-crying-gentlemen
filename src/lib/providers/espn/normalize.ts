import type {
  NormalizedDraftPick,
  NormalizedMatchup,
  NormalizedPlayer,
  NormalizedRosterEntry,
  NormalizedTeam,
  NormalizedTransaction,
} from "../types";
import type { EspnLeagueResponse } from "./schemas";
import { mapEspnLineupSlot, mapEspnPosition } from "./mappings";

/** Result of normalizing players, plus any positions ESPN sent that we don't recognize yet. */
export interface NormalizePlayersResult {
  players: NormalizedPlayer[];
  unmappedPositionIds: number[];
}

export function normalizeTeams(
  league: EspnLeagueResponse,
  year: number,
): NormalizedTeam[] {
  return league.teams.map((team) => ({
    externalTeamId: String(team.id),
    year,
    name:
      team.name ??
      [team.location, team.nickname].filter(Boolean).join(" ").trim() ??
      `Team ${team.id}`,
    abbreviation: team.abbrev ?? null,
    logoUrl: team.logo ?? null,
    ownerExternalIds: team.owners,
    draftSlot: team.draftDayProjectedRank ?? null,
  }));
}

/**
 * Maps ESPN's `playoffTierType` enum to our normalized bracket. ESPN
 * does have a `WINNERS_BRACKET_CHAMPIONSHIP` tier in its enum, but in
 * practice leagues' final round is just tagged `WINNERS_BRACKET` like
 * every earlier round — the championship game is instead identified
 * as the last `WINNERS_BRACKET` week for the season (see below).
 */
function mapEspnPlayoffTier(tierType: string | undefined): NormalizedMatchup["playoffBracket"] {
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

export function normalizeMatchups(
  league: EspnLeagueResponse,
  year: number,
): NormalizedMatchup[] {
  const matchups = league.schedule
    .filter((m) => m.home?.teamId !== undefined && m.away?.teamId !== undefined)
    .map((m) => {
      const playoffBracket = mapEspnPlayoffTier(m.playoffTierType);
      return {
        year,
        week: m.matchupPeriodId,
        homeExternalTeamId: String(m.home!.teamId),
        awayExternalTeamId: String(m.away!.teamId),
        homeScore: m.home?.totalPoints ?? null,
        awayScore: m.away?.totalPoints ?? null,
        isPlayoff: playoffBracket !== null,
        isChampionship: false,
        isFinal: m.winner !== undefined && m.winner !== "UNDECIDED",
        playoffBracket,
      };
    });

  // The championship is the single remaining "winners" bracket game, in
  // the last week any "winners" bracket game was played that season.
  const lastWinnersWeek = Math.max(
    -Infinity,
    ...matchups.filter((m) => m.playoffBracket === "winners").map((m) => m.week),
  );
  for (const m of matchups) {
    if (m.playoffBracket === "winners" && m.week === lastWinnersWeek) {
      m.isChampionship = true;
    }
  }

  return matchups;
}

export function normalizeDraftPicks(
  league: EspnLeagueResponse,
  year: number,
): NormalizedDraftPick[] {
  const picks = league.draftDetail?.picks ?? [];
  return picks.map((p) => ({
    year,
    round: p.roundId,
    pickInRound: p.roundPickNumber,
    overallPick: p.overallPickNumber,
    externalTeamId: String(p.teamId),
    externalPlayerId: String(p.playerId),
    keeper: p.keeper ?? false,
  }));
}

export function normalizeTransactions(
  league: EspnLeagueResponse,
  year: number,
): NormalizedTransaction[] {
  return league.transactions.map((t) => {
    const type = mapEspnTransactionType(t.type);
    const firstItem = t.items[0];
    return {
      year,
      week: t.scoringPeriodId ?? null,
      type,
      externalTeamId: t.teamId !== undefined ? String(t.teamId) : null,
      counterpartyExternalTeamId:
        firstItem?.fromTeamId !== undefined ? String(firstItem.fromTeamId) : null,
      occurredAt: t.proposedDate
        ? new Date(t.proposedDate).toISOString()
        : new Date().toISOString(),
      tradeId: type === "trade" ? t.id : null,
      details: t.items,
    };
  });
}

function mapEspnTransactionType(
  raw: string,
): "add" | "drop" | "trade" | "waiver" {
  const normalized = raw.toUpperCase();
  if (normalized.includes("TRADE")) return "trade";
  if (normalized.includes("WAIVER")) return "waiver";
  if (normalized.includes("DROP")) return "drop";
  return "add";
}

/**
 * Extracts distinct players from roster entries embedded in an
 * mRoster/mBoxscore response. ESPN doesn't expose a standalone "all
 * players" endpoint scoped to a league roster snapshot, so player
 * identity is discovered incrementally as rosters are fetched.
 */
export function normalizePlayersFromRosterEntries(
  entries: {
    playerId: number;
    playerPoolEntry?: { player?: { fullName: string; defaultPositionId?: number; proTeamId?: number } };
  }[],
): NormalizePlayersResult {
  const players: NormalizedPlayer[] = [];
  const unmappedPositionIds: number[] = [];
  const seen = new Set<number>();

  for (const entry of entries) {
    if (seen.has(entry.playerId)) continue;
    seen.add(entry.playerId);

    const player = entry.playerPoolEntry?.player;
    if (!player) continue;

    const position = mapEspnPosition(player.defaultPositionId);
    if (position === null && player.defaultPositionId !== undefined) {
      unmappedPositionIds.push(player.defaultPositionId);
    }

    players.push({
      externalPlayerId: String(entry.playerId),
      fullName: player.fullName,
      position: position ?? "UNKNOWN",
      nflTeam: player.proTeamId !== undefined ? String(player.proTeamId) : null,
    });
  }

  return { players, unmappedPositionIds };
}

export function normalizeRosterEntries(
  entries: { playerId: number; lineupSlotId: number }[],
  externalTeamId: string,
  year: number,
  week: number,
  pointsByPlayerId: Record<number, number> = {},
): { entries: NormalizedRosterEntry[]; unmappedSlotIds: number[] } {
  const normalized: NormalizedRosterEntry[] = [];
  const unmappedSlotIds: number[] = [];

  for (const e of entries) {
    const slotCode = mapEspnLineupSlot(e.lineupSlotId);
    if (slotCode === null) {
      unmappedSlotIds.push(e.lineupSlotId);
      continue;
    }
    normalized.push({
      year,
      week,
      externalTeamId,
      externalPlayerId: String(e.playerId),
      slotCode,
      isStarter: slotCode !== "BE" && slotCode !== "IR",
      points: pointsByPlayerId[e.playerId] ?? null,
    });
  }

  return { entries: normalized, unmappedSlotIds };
}
