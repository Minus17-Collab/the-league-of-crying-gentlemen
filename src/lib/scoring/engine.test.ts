import { describe, expect, it } from "vitest";
import { computePoints } from "./engine";
import type { ScoringRule, StatLine } from "./types";

function statLine(overrides: Partial<StatLine> = {}): StatLine {
  return {
    playerId: "p1",
    year: 2026,
    week: 1,
    statKey: "pass_yd",
    value: 0,
    ...overrides,
  };
}

function rule(overrides: Partial<ScoringRule> = {}): ScoringRule {
  return {
    statKey: "pass_yd",
    pointsPerUnit: 0,
    flatBonus: 0,
    minValue: null,
    maxValue: null,
    positionFilter: null,
    ...overrides,
  };
}

describe("computePoints — per-unit scoring", () => {
  it("returns 0 for no stat lines", () => {
    expect(computePoints([], [rule({ pointsPerUnit: 0.04 })])).toBe(0);
  });

  it("returns 0 for no rules", () => {
    expect(computePoints([statLine({ value: 300 })], [])).toBe(0);
  });

  it("applies a simple per-unit rate: 1pt / 25 passing yards", () => {
    const lines = [statLine({ statKey: "pass_yd", value: 250 })];
    const rules = [rule({ statKey: "pass_yd", pointsPerUnit: 0.04 })];
    expect(computePoints(lines, rules)).toBeCloseTo(10, 5);
  });

  it("applies a per-unit rate for receptions (PPR)", () => {
    const lines = [statLine({ statKey: "rec", value: 7 })];
    const rules = [rule({ statKey: "rec", pointsPerUnit: 1 })];
    expect(computePoints(lines, rules)).toBe(7);
  });

  it("applies a per-unit rate for rushing touchdowns", () => {
    const lines = [statLine({ statKey: "rush_td", value: 2 })];
    const rules = [rule({ statKey: "rush_td", pointsPerUnit: 6 })];
    expect(computePoints(lines, rules)).toBe(12);
  });

  it("sums points across multiple stat lines for the same player-week", () => {
    const lines = [
      statLine({ statKey: "pass_yd", value: 300 }),
      statLine({ statKey: "pass_td", value: 3 }),
      statLine({ statKey: "int", value: 1 }),
    ];
    const rules = [
      rule({ statKey: "pass_yd", pointsPerUnit: 0.04 }),
      rule({ statKey: "pass_td", pointsPerUnit: 4 }),
      rule({ statKey: "int", pointsPerUnit: -2 }),
    ];
    // 300*0.04=12, 3*4=12, 1*-2=-2 => 22
    expect(computePoints(lines, rules)).toBe(22);
  });

  it("ignores stat lines with no matching rule", () => {
    const lines = [statLine({ statKey: "punt_ret_td", value: 1 })];
    const rules = [rule({ statKey: "pass_yd", pointsPerUnit: 0.04 })];
    expect(computePoints(lines, rules)).toBe(0);
  });

  it("ignores rules with no matching stat line", () => {
    const lines = [statLine({ statKey: "pass_yd", value: 100 })];
    const rules = [
      rule({ statKey: "pass_yd", pointsPerUnit: 0.04 }),
      rule({ statKey: "rush_yd", pointsPerUnit: 0.1 }),
    ];
    expect(computePoints(lines, rules)).toBeCloseTo(4, 5);
  });

  it("handles a zero-value stat line as zero contribution", () => {
    const lines = [statLine({ statKey: "rec", value: 0 })];
    const rules = [rule({ statKey: "rec", pointsPerUnit: 1 })];
    expect(computePoints(lines, rules)).toBe(0);
  });

  it("handles fractional point-per-unit rates precisely", () => {
    const lines = [statLine({ statKey: "rush_yd", value: 137 })];
    const rules = [rule({ statKey: "rush_yd", pointsPerUnit: 0.1 })];
    expect(computePoints(lines, rules)).toBeCloseTo(13.7, 5);
  });
});

describe("computePoints — threshold bonuses", () => {
  it("applies a flat bonus when value meets the minimum threshold", () => {
    const lines = [statLine({ statKey: "pass_yd", value: 320 })];
    const rules = [
      rule({ statKey: "pass_yd", minValue: 300, flatBonus: 3 }),
    ];
    expect(computePoints(lines, rules)).toBe(3);
  });

  it("does not apply a flat bonus when value is below the minimum threshold", () => {
    const lines = [statLine({ statKey: "pass_yd", value: 299 })];
    const rules = [
      rule({ statKey: "pass_yd", minValue: 300, flatBonus: 3 }),
    ];
    expect(computePoints(lines, rules)).toBe(0);
  });

  it("applies a flat bonus exactly at the minimum threshold (inclusive)", () => {
    const lines = [statLine({ statKey: "pass_yd", value: 300 })];
    const rules = [
      rule({ statKey: "pass_yd", minValue: 300, flatBonus: 3 }),
    ];
    expect(computePoints(lines, rules)).toBe(3);
  });

  it("does not apply a flat bonus when value exceeds the maximum threshold", () => {
    const lines = [statLine({ statKey: "rush_yd", value: 250 })];
    const rules = [
      rule({ statKey: "rush_yd", minValue: 100, maxValue: 199, flatBonus: 5 }),
    ];
    expect(computePoints(lines, rules)).toBe(0);
  });

  it("applies a flat bonus exactly at the maximum threshold (inclusive)", () => {
    const lines = [statLine({ statKey: "rush_yd", value: 199 })];
    const rules = [
      rule({ statKey: "rush_yd", minValue: 100, maxValue: 199, flatBonus: 5 }),
    ];
    expect(computePoints(lines, rules)).toBe(5);
  });

  it("applies a flat bonus within a min/max range", () => {
    const lines = [statLine({ statKey: "rush_yd", value: 150 })];
    const rules = [
      rule({ statKey: "rush_yd", minValue: 100, maxValue: 199, flatBonus: 5 }),
    ];
    expect(computePoints(lines, rules)).toBe(5);
  });

  it("combines a per-unit rate and a threshold bonus for the same stat", () => {
    const lines = [statLine({ statKey: "pass_yd", value: 320 })];
    const rules = [
      rule({ statKey: "pass_yd", pointsPerUnit: 0.04 }),
      rule({ statKey: "pass_yd", minValue: 300, flatBonus: 3 }),
    ];
    // 320*0.04 = 12.8, plus 3 bonus = 15.8
    expect(computePoints(lines, rules)).toBeCloseTo(15.8, 5);
  });

  it("stacks multiple independent threshold bonuses for the same stat key", () => {
    const lines = [statLine({ statKey: "rec_yd", value: 220 })];
    const rules = [
      rule({ statKey: "rec_yd", minValue: 100, flatBonus: 2 }),
      rule({ statKey: "rec_yd", minValue: 200, flatBonus: 3 }),
    ];
    // Both thresholds met: 2 + 3 = 5
    expect(computePoints(lines, rules)).toBe(5);
  });

  it("applies only the lower threshold bonus when the higher one is not met", () => {
    const lines = [statLine({ statKey: "rec_yd", value: 150 })];
    const rules = [
      rule({ statKey: "rec_yd", minValue: 100, flatBonus: 2 }),
      rule({ statKey: "rec_yd", minValue: 200, flatBonus: 3 }),
    ];
    expect(computePoints(lines, rules)).toBe(2);
  });

  it("treats a rule with no thresholds as always eligible for its flat bonus", () => {
    const lines = [statLine({ statKey: "two_pt", value: 1 })];
    const rules = [rule({ statKey: "two_pt", flatBonus: 2 })];
    expect(computePoints(lines, rules)).toBe(2);
  });
});

describe("computePoints — position filters", () => {
  it("applies a rule with no positionFilter regardless of player position", () => {
    const lines = [statLine({ statKey: "fum_lost", value: 1, position: "RB" })];
    const rules = [rule({ statKey: "fum_lost", pointsPerUnit: -2, positionFilter: null })];
    expect(computePoints(lines, rules)).toBe(-2);
  });

  it("applies a position-filtered rule when the player matches", () => {
    const lines = [statLine({ statKey: "fg_40_49", value: 1, position: "K" })];
    const rules = [
      rule({ statKey: "fg_40_49", pointsPerUnit: 4, positionFilter: ["K"] }),
    ];
    expect(computePoints(lines, rules)).toBe(4);
  });

  it("skips a position-filtered rule when the player does not match", () => {
    const lines = [statLine({ statKey: "fg_40_49", value: 1, position: "QB" })];
    const rules = [
      rule({ statKey: "fg_40_49", pointsPerUnit: 4, positionFilter: ["K"] }),
    ];
    expect(computePoints(lines, rules)).toBe(0);
  });

  it("skips a position-filtered rule when the stat line has no position", () => {
    const lines = [statLine({ statKey: "fg_40_49", value: 1, position: undefined })];
    const rules = [
      rule({ statKey: "fg_40_49", pointsPerUnit: 4, positionFilter: ["K"] }),
    ];
    expect(computePoints(lines, rules)).toBe(0);
  });

  it("matches a position filter with multiple eligible positions", () => {
    const lines = [statLine({ statKey: "rec", value: 5, position: "TE" })];
    const rules = [
      rule({ statKey: "rec", pointsPerUnit: 1, positionFilter: ["RB", "WR", "TE"] }),
    ];
    expect(computePoints(lines, rules)).toBe(5);
  });

  it("applies different rules to the same stat key for different positions", () => {
    const rbLine = statLine({ statKey: "rec", value: 3, position: "RB" });
    const wrLine = statLine({ statKey: "rec", value: 3, position: "WR", playerId: "p2" });
    const rules = [
      rule({ statKey: "rec", pointsPerUnit: 0.5, positionFilter: ["RB"] }),
      rule({ statKey: "rec", pointsPerUnit: 1, positionFilter: ["WR"] }),
    ];
    expect(computePoints([rbLine], rules)).toBe(1.5);
    expect(computePoints([wrLine], rules)).toBe(3);
  });

  it("applies an empty positionFilter array as unrestricted", () => {
    const lines = [statLine({ statKey: "fum_lost", value: 1, position: "QB" })];
    const rules = [
      rule({ statKey: "fum_lost", pointsPerUnit: -2, positionFilter: [] }),
    ];
    expect(computePoints(lines, rules)).toBe(-2);
  });
});

describe("computePoints — negative points", () => {
  it("applies negative points for interceptions", () => {
    const lines = [statLine({ statKey: "int", value: 3 })];
    const rules = [rule({ statKey: "int", pointsPerUnit: -2 })];
    expect(computePoints(lines, rules)).toBe(-6);
  });

  it("applies negative points for fumbles lost", () => {
    const lines = [statLine({ statKey: "fum_lost", value: 2 })];
    const rules = [rule({ statKey: "fum_lost", pointsPerUnit: -2 })];
    expect(computePoints(lines, rules)).toBe(-4);
  });

  it("allows a season total to go negative", () => {
    const lines = [
      statLine({ statKey: "pass_yd", value: 20 }),
      statLine({ statKey: "int", value: 4 }),
    ];
    const rules = [
      rule({ statKey: "pass_yd", pointsPerUnit: 0.04 }),
      rule({ statKey: "int", pointsPerUnit: -2 }),
    ];
    // 20*0.04=0.8, 4*-2=-8 => -7.2
    expect(computePoints(lines, rules)).toBeCloseTo(-7.2, 5);
  });

  it("applies a negative flat bonus (penalty threshold)", () => {
    const lines = [statLine({ statKey: "pass_yd", value: 50 })];
    const rules = [
      rule({ statKey: "pass_yd", maxValue: 99, flatBonus: -1 }),
    ];
    expect(computePoints(lines, rules)).toBe(-1);
  });
});

describe("computePoints — empty-input edge cases", () => {
  it("returns 0 for empty stat lines and empty rules", () => {
    expect(computePoints([], [])).toBe(0);
  });

  it("handles multiple players' stat lines independently within one call", () => {
    const lines = [
      statLine({ playerId: "p1", statKey: "rec", value: 5 }),
      statLine({ playerId: "p2", statKey: "rec", value: 3 }),
    ];
    const rules = [rule({ statKey: "rec", pointsPerUnit: 1 })];
    // computePoints sums everything passed to it; callers pass one
    // player's lines at a time in practice, but the function itself
    // has no player-scoping logic to break.
    expect(computePoints(lines, rules)).toBe(8);
  });

  it("does not mutate the input stat lines array", () => {
    const lines = [statLine({ statKey: "rec", value: 5 })];
    const rules = [rule({ statKey: "rec", pointsPerUnit: 1 })];
    const snapshot = JSON.stringify(lines);
    computePoints(lines, rules);
    expect(JSON.stringify(lines)).toBe(snapshot);
  });

  it("does not mutate the input rules array", () => {
    const lines = [statLine({ statKey: "rec", value: 5 })];
    const rules = [rule({ statKey: "rec", pointsPerUnit: 1 })];
    const snapshot = JSON.stringify(rules);
    computePoints(lines, rules);
    expect(JSON.stringify(rules)).toBe(snapshot);
  });

  it("is deterministic across repeated calls with the same input", () => {
    const lines = [statLine({ statKey: "pass_yd", value: 275 })];
    const rules = [rule({ statKey: "pass_yd", pointsPerUnit: 0.04 })];
    const first = computePoints(lines, rules);
    const second = computePoints(lines, rules);
    expect(first).toBe(second);
  });

  it("handles a large number of stat lines without error", () => {
    const lines = Array.from({ length: 500 }, (_, i) =>
      statLine({ statKey: "rec", value: 1, playerId: `p${i}` }),
    );
    const rules = [rule({ statKey: "rec", pointsPerUnit: 1 })];
    expect(computePoints(lines, rules)).toBe(500);
  });
});
