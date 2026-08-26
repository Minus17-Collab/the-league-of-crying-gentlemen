import { describe, expect, it } from "vitest";
import {
  computeDraftNightGrade,
  computeExpectedPointsByRound,
  computeRegrade,
  poolAdjacentViolatorsNonIncreasing,
} from "./draftGrades";
import type { GradablePick } from "./types";

function pick(overrides: Partial<GradablePick> = {}): GradablePick {
  return {
    draftPickId: "pick1",
    seasonId: "s2024",
    round: 1,
    overallPick: 1,
    seasonPoints: 100,
    adpAtPick: 1,
    ...overrides,
  };
}

describe("poolAdjacentViolatorsNonIncreasing", () => {
  it("leaves an already non-increasing sequence unchanged", () => {
    const entries = [
      { round: 1, value: 100, weight: 5 },
      { round: 2, value: 80, weight: 5 },
      { round: 3, value: 50, weight: 5 },
    ];
    expect(poolAdjacentViolatorsNonIncreasing(entries)).toEqual([100, 80, 50]);
  });

  it("pools an increasing violation into a flat, weighted average", () => {
    const entries = [
      { round: 1, value: 50, weight: 1 },
      { round: 2, value: 70, weight: 1 }, // violates non-increasing
    ];
    // Equal weights -> average of 50 and 70 = 60 for both.
    expect(poolAdjacentViolatorsNonIncreasing(entries)).toEqual([60, 60]);
  });

  it("weights the pooled average by sample count", () => {
    const entries = [
      { round: 1, value: 50, weight: 3 },
      { round: 2, value: 80, weight: 1 }, // violates, but low weight
    ];
    // (50*3 + 80*1) / 4 = 57.5
    expect(poolAdjacentViolatorsNonIncreasing(entries)).toEqual([57.5, 57.5]);
  });

  it("propagates a pooled violation backward if needed", () => {
    const entries = [
      { round: 1, value: 40, weight: 1 },
      { round: 2, value: 40, weight: 1 },
      { round: 3, value: 100, weight: 1 },
    ];
    // Round 3 violates against round 2; pooling (40,40,100) with equal
    // weight collapses to a single flat value of 60 across all three.
    const result = poolAdjacentViolatorsNonIncreasing(entries);
    expect(result[0]).toBeCloseTo(60, 5);
    expect(result[1]).toBeCloseTo(60, 5);
    expect(result[2]).toBeCloseTo(60, 5);
  });

  it("returns an empty array for empty input", () => {
    expect(poolAdjacentViolatorsNonIncreasing([])).toEqual([]);
  });

  it("handles a single entry", () => {
    expect(poolAdjacentViolatorsNonIncreasing([{ round: 1, value: 42, weight: 1 }])).toEqual([42]);
  });
});

describe("computeExpectedPointsByRound", () => {
  it("averages season points pooled across seasons for the same round", () => {
    const picks = [
      pick({ draftPickId: "a", seasonId: "s1", round: 1, seasonPoints: 200 }),
      pick({ draftPickId: "b", seasonId: "s2", round: 1, seasonPoints: 100 }),
    ];
    const result = computeExpectedPointsByRound(picks);
    expect(result.get(1)).toBe(150);
  });

  it("excludes picks with null seasonPoints from the average", () => {
    const picks = [
      pick({ draftPickId: "a", round: 1, seasonPoints: 200 }),
      pick({ draftPickId: "b", round: 1, seasonPoints: null }),
    ];
    expect(computeExpectedPointsByRound(picks).get(1)).toBe(200);
  });

  it("produces a non-increasing curve across rounds even with noisy input", () => {
    const picks = [
      pick({ draftPickId: "a", round: 1, seasonPoints: 100 }),
      pick({ draftPickId: "b", round: 2, seasonPoints: 130 }), // noisy: round 2 > round 1
      pick({ draftPickId: "c", round: 3, seasonPoints: 40 }),
    ];
    const result = computeExpectedPointsByRound(picks);
    const r1 = result.get(1) ?? 0;
    const r2 = result.get(2) ?? 0;
    const r3 = result.get(3) ?? 0;
    expect(r1).toBeGreaterThanOrEqual(r2);
    expect(r2).toBeGreaterThanOrEqual(r3);
  });

  it("returns an empty map for no picks", () => {
    expect(computeExpectedPointsByRound([]).size).toBe(0);
  });
});

describe("computeRegrade", () => {
  it("computes a positive VOE and a top grade for a pick that outperformed its round", () => {
    const picks = [
      pick({ draftPickId: "a", round: 3, seasonPoints: 50 }),
      pick({ draftPickId: "b", round: 3, seasonPoints: 250, seasonId: "s2024" }),
    ];
    const [regradeA, regradeB] = computeRegrade(picks);
    expect(regradeB.voe).toBeGreaterThan(regradeA.voe ?? 0);
    expect(regradeB.regradeGrade).toBe("A+");
  });

  it("ranks picks within a season by VOE, independent of other seasons", () => {
    const picks = [
      pick({ draftPickId: "a", seasonId: "s1", round: 1, seasonPoints: 300 }),
      pick({ draftPickId: "b", seasonId: "s1", round: 1, seasonPoints: 100 }),
      pick({ draftPickId: "c", seasonId: "s2", round: 1, seasonPoints: 300 }),
    ];
    const results = computeRegrade(picks);
    const byId = new Map(results.map((r) => [r.draftPickId, r]));
    expect(byId.get("a")?.regradeRank).toBe(1);
    expect(byId.get("b")?.regradeRank).toBe(2);
    expect(byId.get("c")?.regradeRank).toBe(1);
  });

  it("returns null voe, grade, and rank for a pick with no season points", () => {
    const picks = [pick({ draftPickId: "a", seasonPoints: null })];
    const [result] = computeRegrade(picks);
    expect(result.voe).toBeNull();
    expect(result.regradeGrade).toBeNull();
    expect(result.regradeRank).toBeNull();
  });

  it("still reports expectedPoints from other picks in the round even if this pick has none", () => {
    const picks = [
      pick({ draftPickId: "a", round: 5, seasonPoints: 80 }),
      pick({ draftPickId: "b", round: 5, seasonPoints: null }),
    ];
    const results = computeRegrade(picks);
    const b = results.find((r) => r.draftPickId === "b");
    expect(b?.expectedPoints).toBe(80);
    expect(b?.voe).toBeNull();
  });

  it("is deterministic across repeated calls", () => {
    const picks = [
      pick({ draftPickId: "a", round: 1, seasonPoints: 120 }),
      pick({ draftPickId: "b", round: 2, seasonPoints: 90 }),
    ];
    expect(computeRegrade(picks)).toEqual(computeRegrade(picks));
  });
});

describe("computeDraftNightGrade", () => {
  it("ranks reach values within a season by mid-rank percentile and bands them", () => {
    // sorted reach values: [-40, 0, 40] -> percentiles 0.1667, 0.5, 0.8333
    const picks = [
      pick({ draftPickId: "a", seasonId: "s1", overallPick: 50, adpAtPick: 10 }), // reach +40 (steal)
      pick({ draftPickId: "b", seasonId: "s1", overallPick: 10, adpAtPick: 50 }), // reach -40 (big reach)
      pick({ draftPickId: "c", seasonId: "s1", overallPick: 20, adpAtPick: 20 }), // reach 0
    ];
    const results = computeDraftNightGrade(picks);
    const byId = new Map(results.map((r) => [r.draftPickId, r]));
    expect(byId.get("a")?.reachValue).toBe(40);
    expect(byId.get("b")?.reachValue).toBe(-40);
    expect(byId.get("a")?.draftNightGrade).toBe("A-");
    expect(byId.get("b")?.draftNightGrade).toBe("C");
    expect(byId.get("c")?.draftNightGrade).toBe("B");
  });

  it("returns null reachValue and grade when ADP could not be matched", () => {
    const picks = [pick({ draftPickId: "a", adpAtPick: null })];
    const [result] = computeDraftNightGrade(picks);
    expect(result.reachValue).toBeNull();
    expect(result.draftNightGrade).toBeNull();
  });

  it("curves within one season independent of another season's picks", () => {
    // In season s1, pick "a" is the best of 2 (top percentile); in
    // season s2, an identical reach value is the only pick in its pool
    // (mid percentile by default) — grading must not mix the pools.
    const picks = [
      pick({ draftPickId: "a", seasonId: "s1", overallPick: 50, adpAtPick: 10 }),
      pick({ draftPickId: "b", seasonId: "s1", overallPick: 10, adpAtPick: 50 }),
      pick({ draftPickId: "c", seasonId: "s2", overallPick: 50, adpAtPick: 10 }),
    ];
    const results = computeDraftNightGrade(picks);
    const a = results.find((r) => r.draftPickId === "a");
    const c = results.find((r) => r.draftPickId === "c");
    expect(a?.draftNightGrade).toBe("A-");
    expect(c?.draftNightGrade).toBe("B");
  });

  it("does not let unmatched-ADP picks affect other picks' percentile in the same season", () => {
    const picks = [
      pick({ draftPickId: "a", seasonId: "s1", overallPick: 50, adpAtPick: 10 }),
      pick({ draftPickId: "b", seasonId: "s1", adpAtPick: null }),
    ];
    const results = computeDraftNightGrade(picks);
    const a = results.find((r) => r.draftPickId === "a");
    // Only pick in the season's valid pool -> alone -> mid-percentile grade.
    expect(a?.reachValue).toBe(40);
    expect(a?.draftNightGrade).toBe("B");
  });
});
