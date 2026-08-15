// One-off data-processing script for the initial historical pull (2023-2025).
// Reads raw ESPN leagueHistory dumps from data/espn-raw/{year}/settings-teams.json
// and produces normalized summaries under data/history/.
//
// Not part of the app runtime — run manually with `node scripts/analyze-espn-history.mjs`.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const YEARS = [2023, 2024, 2025];

function loadSeason(year) {
  const raw = readFileSync(
    join(ROOT, "data", "espn-raw", String(year), "settings-teams.json"),
    "utf-8",
  );
  const [league] = JSON.parse(raw);
  return league;
}

const seasons = {};
for (const year of YEARS) {
  seasons[year] = loadSeason(year);
}

// ---- 1. Managers per season (owner GUID -> name), + presence across years ----
const managersBySeason = {};
const allManagerIds = new Set();
for (const year of YEARS) {
  const league = seasons[year];
  managersBySeason[year] = league.members.map((m) => ({
    id: m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    displayName: m.displayName,
  }));
  for (const m of league.members) allManagerIds.add(m.id);
}

const managerTimeline = [...allManagerIds].map((id) => {
  const appearsIn = YEARS.filter((y) =>
    managersBySeason[y].some((m) => m.id === id),
  );
  const info =
    YEARS.map((y) => managersBySeason[y].find((m) => m.id === id)).find(
      Boolean,
    ) ?? {};
  const lastYear = Math.max(...appearsIn);
  const retiredAfter =
    lastYear !== YEARS[YEARS.length - 1] ? lastYear : null;
  return {
    espnOwnerId: id,
    name: `${info.firstName ?? "?"} ${info.lastName ?? "?"}`,
    seasonsActive: appearsIn,
    inferredRetiredAfterSeason: retiredAfter,
  };
});

// ---- 2. Teams + final records per season ----
const teamsBySeason = {};
for (const year of YEARS) {
  const league = seasons[year];
  teamsBySeason[year] = league.teams.map((t) => ({
    teamId: t.id,
    name: t.name,
    abbrev: t.abbrev,
    owners: t.owners,
    playoffSeed: t.playoffSeed,
    rankCalculatedFinal: t.rankCalculatedFinal,
    pointsFor: t.record?.overall?.pointsFor ?? null,
    pointsAgainst: t.record?.overall?.pointsAgainst ?? null,
    wins: t.record?.overall?.wins ?? null,
    losses: t.record?.overall?.losses ?? null,
    ties: t.record?.overall?.ties ?? null,
  }));
}

// ---- 3. Head-to-head matchups (regular + playoff) per season ----
const matchupsBySeason = {};
for (const year of YEARS) {
  const league = seasons[year];
  const playoffStartWeek = league.settings.scheduleSettings.matchupPeriodCount + 1;
  matchupsBySeason[year] = league.schedule.map((g) => {
    const homeScore = g.home?.totalPoints ?? null;
    const awayScore = g.away?.totalPoints ?? null;
    let winner = null;
    if (!g.away) winner = "home"; // bye week
    else if (homeScore != null && awayScore != null) {
      if (homeScore > awayScore) winner = "home";
      else if (awayScore > homeScore) winner = "away";
      else winner = "tie";
    }
    return {
      week: g.matchupPeriodId,
      isPlayoff: g.matchupPeriodId >= playoffStartWeek,
      homeTeamId: g.home?.teamId ?? null,
      homeScore,
      awayTeamId: g.away?.teamId ?? null,
      awayScore,
      winner,
    };
  });
}

// ---- 4. Scoring rules per season (statId -> points), for diffing ----
const scoringBySeason = {};
for (const year of YEARS) {
  const league = seasons[year];
  const items = league.settings.scoringSettings.scoringItems;
  const map = {};
  for (const item of items) {
    map[item.statId] = {
      points: item.points,
      pointsOverrides: item.pointsOverrides ?? {},
    };
  }
  scoringBySeason[year] = {
    scoringType: league.settings.scoringSettings.scoringType,
    playerRankType: league.settings.scoringSettings.playerRankType,
    items: map,
  };
}

// ---- 5. Scoring diffs year-over-year ----
function diffScoring(yearA, yearB) {
  const a = scoringBySeason[yearA].items;
  const b = scoringBySeason[yearB].items;
  const allIds = new Set([...Object.keys(a), ...Object.keys(b)]);
  const diffs = [];
  for (const id of allIds) {
    const av = a[id];
    const bv = b[id];
    if (JSON.stringify(av) !== JSON.stringify(bv)) {
      diffs.push({ statId: id, [yearA]: av ?? null, [yearB]: bv ?? null });
    }
  }
  return diffs;
}

const scoringDiffs = {
  "2023_to_2024": diffScoring(2023, 2024),
  "2024_to_2025": diffScoring(2024, 2025),
};

// ---- 6. League format changes (team count, playoff format) ----
const formatBySeason = {};
for (const year of YEARS) {
  const league = seasons[year];
  formatBySeason[year] = {
    teamCount: league.status.teamsJoined,
    matchupPeriodCount: league.settings.scheduleSettings.matchupPeriodCount,
    playoffTeamCount: league.settings.scheduleSettings.playoffTeamCount,
    divisions: league.settings.scheduleSettings.divisions?.map((d) => ({
      name: d.name,
      size: d.size,
    })),
    playoffMatchupPeriodLength:
      league.settings.scheduleSettings.playoffMatchupPeriodLength,
    draftType: league.settings.draftSettings.type,
    keeperCount: league.settings.draftSettings.keeperCount,
  };
}

// ---- Write outputs ----
mkdirSync(join(ROOT, "data", "history"), { recursive: true });

writeFileSync(
  join(ROOT, "data", "history", "managers.json"),
  JSON.stringify(managerTimeline, null, 2),
);
writeFileSync(
  join(ROOT, "data", "history", "teams-by-season.json"),
  JSON.stringify(teamsBySeason, null, 2),
);
writeFileSync(
  join(ROOT, "data", "history", "matchups-by-season.json"),
  JSON.stringify(matchupsBySeason, null, 2),
);
writeFileSync(
  join(ROOT, "data", "history", "scoring-by-season.json"),
  JSON.stringify(scoringBySeason, null, 2),
);
writeFileSync(
  join(ROOT, "data", "history", "scoring-diffs.json"),
  JSON.stringify(scoringDiffs, null, 2),
);
writeFileSync(
  join(ROOT, "data", "history", "format-by-season.json"),
  JSON.stringify(formatBySeason, null, 2),
);

console.log("Done. Wrote 6 files to data/history/");
console.log("Managers found:", managerTimeline.length);
console.log(
  "Scoring diffs 2023->2024:",
  scoringDiffs["2023_to_2024"].length,
  "| 2024->2025:",
  scoringDiffs["2024_to_2025"].length,
);
