// One-off historical pull: draft results + transaction log for 2023-2025.
// Fills the two "Known gaps" flagged in data/history/SUMMARY.md after the
// initial pull: no mDraftDetail, no mTransactions2 data was fetched yet.
//
// Not part of the app runtime — run manually with:
//   node scripts/fetch-draft-and-transactions.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const LEAGUE_ID = "771894515";
const YEARS = [2023, 2024, 2025];

const SWID = process.env.ESPN_SWID;
const S2 = process.env.ESPN_S2;
if (!SWID || !S2) {
  console.error("ESPN_SWID / ESPN_S2 must be set in the environment.");
  process.exit(1);
}

const headers = { Cookie: `SWID=${SWID}; espn_s2=${S2}` };

async function fetchView(year, view) {
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${LEAGUE_ID}?view=${view}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`${year} ${view}: HTTP ${res.status}`);
  }
  return res.json();
}

function extractDraft(json) {
  const picks = json.draftDetail?.picks ?? [];
  return picks.map((p) => ({
    overallPickNumber: p.overallPickNumber,
    roundId: p.roundId,
    roundPickNumber: p.roundPickNumber,
    teamId: p.teamId,
    playerId: p.playerId,
    keeper: p.keeper ?? false,
    autoDraftTypeId: p.autoDraftTypeId ?? null,
  }));
}

function extractTransactions(json) {
  const txns = json.transactions ?? [];
  return txns.map((t) => ({
    id: t.id,
    type: t.type,
    status: t.status,
    scoringPeriodId: t.scoringPeriodId,
    proposedDate: t.proposedDate ?? null,
    teamId: t.teamId ?? null,
    items: (t.items ?? []).map((i) => ({
      playerId: i.playerId,
      type: i.type,
      fromTeamId: i.fromTeamId,
      toTeamId: i.toTeamId,
    })),
  }));
}

async function run() {
  const draftBySeason = {};
  const transactionsBySeason = {};

  for (const year of YEARS) {
    process.stdout.write(`Fetching ${year} draft detail... `);
    try {
      const draftJson = await fetchView(year, "mDraftDetail");
      draftBySeason[year] = extractDraft(draftJson);
      console.log(`ok (${draftBySeason[year].length} picks)`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      draftBySeason[year] = null;
    }
    await new Promise((r) => setTimeout(r, 150));

    process.stdout.write(`Fetching ${year} transactions... `);
    try {
      const txnJson = await fetchView(year, "mTransactions2");
      transactionsBySeason[year] = extractTransactions(txnJson);
      console.log(`ok (${transactionsBySeason[year].length} transactions)`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      transactionsBySeason[year] = null;
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  mkdirSync(join(ROOT, "data", "history"), { recursive: true });
  writeFileSync(
    join(ROOT, "data", "history", "draft-picks-by-season.json"),
    JSON.stringify(draftBySeason, null, 2),
  );
  writeFileSync(
    join(ROOT, "data", "history", "transactions-by-season.json"),
    JSON.stringify(transactionsBySeason, null, 2),
  );
  console.log("Wrote data/history/draft-picks-by-season.json and transactions-by-season.json");
}

run();
