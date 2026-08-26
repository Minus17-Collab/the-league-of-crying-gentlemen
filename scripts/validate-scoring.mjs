// Validation: recompute every lineup_entries.points value from
// stat_lines + scoring_rules using the exact scoring engine
// (src/lib/scoring/engine.ts) and compare against ESPN's cached total.
// This is the Phase 1.2 "golden file" style check, run against the full
// 2023-2025 backfill rather than a small fixture.
//
// Run with:
//   node --env-file=.env.local scripts/validate-scoring.mjs

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// PostgREST caps responses at 1000 rows by default — page through
// everything so large tables (stat_lines, lineup_entries) aren't
// silently truncated.
async function fetchAll(builderFn) {
  const pageSize = 1000;
  let all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await builderFn().range(from, from + pageSize - 1);
    if (error) throw error;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// Inline copy of lib/scoring/engine.ts computePoints (kept in sync manually
// — this is a one-off validation script, not app runtime code).
function computePoints(statLines, rules) {
  let total = 0;
  for (const line of statLines) {
    for (const rule of rules) {
      if (rule.stat_key !== line.stat_key) continue;
      if (rule.position_filter && rule.position_filter.length > 0) {
        if (!line.position || !rule.position_filter.includes(line.position)) continue;
      }
      total += Number(rule.points_per_unit) * Number(line.value);
      const min = rule.min_value;
      const max = rule.max_value;
      const satisfied =
        (min === null || Number(line.value) >= Number(min)) &&
        (max === null || Number(line.value) <= Number(max));
      if (satisfied) total += Number(rule.flat_bonus);
    }
  }
  return total;
}

async function run() {
  for (const year of [2023, 2024, 2025]) {
    const { data: season } = await supabase
      .from("seasons")
      .select("id")
      .eq("year", year)
      .single();

    const rules = await fetchAll(() =>
      supabase
        .from("scoring_rules")
        .select("stat_key, points_per_unit, flat_bonus, min_value, max_value, position_filter")
        .eq("season_id", season.id),
    );

    const lineupEntries = await fetchAll(() =>
      supabase
        .from("lineup_entries")
        .select("id, week, points, player_id, players(full_name, position), teams!inner(season_id)")
        .eq("teams.season_id", season.id),
    );

    const statLines = await fetchAll(() =>
      supabase.from("stat_lines").select("player_id, week, stat_key, value").eq("year", year),
    );

    const linesByPlayerWeek = new Map();
    for (const line of statLines) {
      const key = `${line.player_id}|${line.week}`;
      if (!linesByPlayerWeek.has(key)) linesByPlayerWeek.set(key, []);
      linesByPlayerWeek.get(key).push({ ...line, position: null });
    }

    let matched = 0;
    let mismatched = 0;
    let noStatLines = 0;
    const mismatches = [];

    for (const entry of lineupEntries) {
      if (entry.points === null) continue;
      const key = `${entry.player_id}|${entry.week}`;
      const lines = linesByPlayerWeek.get(key);
      if (!lines || lines.length === 0) {
        noStatLines++;
        continue;
      }
      const position = entry.players?.position ?? null;
      const linesWithPosition = lines.map((l) => ({ ...l, position }));
      const computed = computePoints(linesWithPosition, rules);
      const diff = Math.abs(computed - Number(entry.points));
      if (diff < 0.05) {
        matched++;
      } else {
        mismatched++;
        mismatches.push({
          player: entry.players?.full_name,
          week: entry.week,
          espn: Number(entry.points),
          computed: Math.round(computed * 100) / 100,
          diff: Math.round(diff * 100) / 100,
        });
      }
    }

    console.log(`\n=== ${year} ===`);
    console.log(`matched: ${matched}, mismatched: ${mismatched}, no stat_lines: ${noStatLines}`);
    if (mismatches.length > 0) {
      const worst = mismatches.sort((a, b) => b.diff - a.diff).slice(0, 15);
      console.log("worst mismatches:");
      for (const m of worst) {
        console.log(`  ${m.player} wk${m.week}: espn=${m.espn} computed=${m.computed} diff=${m.diff}`);
      }
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
