/**
 * Interim data access for the public site.
 *
 * Reads directly from the normalized JSON files in `data/history/`
 * (produced by `scripts/analyze-espn-history.mjs`) instead of Supabase.
 * There is no database yet (see ROADMAP.md Phase 0.2/0.3), so this is a
 * bare-bones stand-in for Phase 3.1 "League history" pages.
 *
 * Every function here is a placeholder for a future Supabase query.
 * Do NOT add scoring computation here — this only ever displays values
 * ESPN already computed (`pointsFor`, `wins`, etc.), per AGENTS.md
 * "Scoring is data, never code".
 */

import managersJson from "../../../data/history/managers.json";
import teamsBySeasonJson from "../../../data/history/teams-by-season.json";
import formatBySeasonJson from "../../../data/history/format-by-season.json";
import scoringBySeasonJson from "../../../data/history/scoring-by-season.json";
import scoringDiffsJson from "../../../data/history/scoring-diffs.json";

export interface Manager {
  espnOwnerId: string;
  name: string;
  seasonsActive: number[];
  inferredRetiredAfterSeason: number | null;
}

export interface TeamSeasonRecord {
  teamId: number;
  name: string;
  abbrev: string;
  owners: string[];
  playoffSeed: number;
  rankCalculatedFinal: number;
  pointsFor: number;
  pointsAgainst: number;
  wins: number;
  losses: number;
  ties: number;
}

export interface SeasonFormat {
  teamCount: number;
  matchupPeriodCount: number;
  playoffTeamCount: number;
  divisions: { name: string; size: number }[];
  playoffMatchupPeriodLength: number;
  draftType: string;
  keeperCount: number;
}

export interface ScoringItem {
  points: number;
  pointsOverrides: Record<string, number>;
}

export interface SeasonScoring {
  scoringType: string;
  playerRankType: string;
  items: Record<string, ScoringItem>;
}

export interface ScoringDiffEntry {
  statId: string;
  [season: string]: ScoringItem | string | null;
}

const managers = managersJson as Manager[];
const teamsBySeason = teamsBySeasonJson as Record<string, TeamSeasonRecord[]>;
const formatBySeason = formatBySeasonJson as Record<string, SeasonFormat>;
const scoringBySeason = scoringBySeasonJson as Record<string, SeasonScoring>;
const scoringDiffs = scoringDiffsJson as unknown as Record<string, ScoringDiffEntry[]>;

const managersByOwnerId = new Map(managers.map((m) => [m.espnOwnerId, m]));

export function getSeasons(): string[] {
  return Object.keys(teamsBySeason).sort((a, b) => Number(b) - Number(a));
}

export function getManagers(): Manager[] {
  return [...managers].sort((a, b) => a.name.localeCompare(b.name));
}

export function getManagerName(ownerId: string | undefined): string {
  if (!ownerId) return "Unclaimed";
  return managersByOwnerId.get(ownerId)?.name ?? "Unknown";
}

export function getStandings(season: string): TeamSeasonRecord[] {
  const teams = teamsBySeason[season] ?? [];
  return [...teams].sort((a, b) => a.rankCalculatedFinal - b.rankCalculatedFinal);
}

export function getFormat(season: string): SeasonFormat | undefined {
  return formatBySeason[season];
}

export function getScoring(season: string): SeasonScoring | undefined {
  return scoringBySeason[season];
}

export function getScoringDiff(season: string): ScoringDiffEntry[] {
  return scoringDiffs[season] ?? [];
}

export function getAllScoringSeasons(): string[] {
  return Object.keys(scoringBySeason).sort((a, b) => Number(a) - Number(b));
}
