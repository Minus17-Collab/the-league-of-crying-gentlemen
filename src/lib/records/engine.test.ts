import { describe, expect, it } from "vitest";
import {
  bestAvgMarginOfVictory,
  highestSingleWeek,
  longestLosingStreak,
  longestWinStreak,
  lowestSingleWeek,
  luckiestSeason,
  seasonAllPlayLuck,
  seasonMargins,
  seasonTotals,
  toughestSchedule,
  toughestScheduleAllTime,
  unluckiestSeason,
  worstAvgMarginOfDefeat,
} from "./engine";
import type { TeamWeekResult } from "./types";

function game(overrides: Partial<TeamWeekResult> = {}): TeamWeekResult {
  return {
    franchiseId: "a",
    seasonYear: 2024,
    week: 1,
    points: 100,
    opponentFranchiseId: "b",
    opponentPoints: 90,
    isPlayoff: false,
    ...overrides,
  };
}

describe("highestSingleWeek / lowestSingleWeek", () => {
  it("returns every franchise tied at the max as co-holders", () => {
    const games = [
      game({ franchiseId: "a", points: 150 }),
      game({ franchiseId: "b", points: 150 }),
      game({ franchiseId: "c", points: 100 }),
    ];
    const result = highestSingleWeek(games);
    expect(result.value).toBe(150);
    expect(result.holders.map((h) => h.franchiseId).sort()).toEqual(["a", "b"]);
  });

  it("picks the single minimum when there is no tie", () => {
    const games = [game({ franchiseId: "a", points: 150 }), game({ franchiseId: "b", points: 40 })];
    const result = lowestSingleWeek(games);
    expect(result.value).toBe(40);
    expect(result.holders).toHaveLength(1);
    expect(result.holders[0].franchiseId).toBe("b");
  });

  it("returns an empty result for no games", () => {
    expect(highestSingleWeek([]).holders).toEqual([]);
  });
});

describe("seasonTotals", () => {
  it("sums points per franchise per season independently", () => {
    const games = [
      game({ franchiseId: "a", seasonYear: 2024, week: 1, points: 100 }),
      game({ franchiseId: "a", seasonYear: 2024, week: 2, points: 120 }),
      game({ franchiseId: "a", seasonYear: 2025, week: 1, points: 200 }),
    ];
    const totals = seasonTotals(games);
    expect(totals.find((t) => t.seasonYear === 2024)?.totalPoints).toBe(220);
    expect(totals.find((t) => t.seasonYear === 2025)?.totalPoints).toBe(200);
  });
});

describe("seasonMargins", () => {
  it("averages margin of victory over wins only and margin of defeat over losses only", () => {
    const games = [
      game({ franchiseId: "a", week: 1, points: 120, opponentPoints: 100 }), // win, +20
      game({ franchiseId: "a", week: 2, points: 110, opponentPoints: 90 }), // win, +20
      game({ franchiseId: "a", week: 3, points: 80, opponentPoints: 100 }), // loss, -20
    ];
    const [margin] = seasonMargins(games);
    expect(margin.avgMarginOfVictory).toBe(20);
    expect(margin.avgMarginOfDefeat).toBe(20);
  });

  it("returns null margin of victory for a franchise with zero wins", () => {
    const games = [game({ franchiseId: "a", points: 50, opponentPoints: 100 })];
    const [margin] = seasonMargins(games);
    expect(margin.avgMarginOfVictory).toBeNull();
    expect(margin.avgMarginOfDefeat).toBe(50);
  });

  it("bestAvgMarginOfVictory and worstAvgMarginOfDefeat ignore null values and tie correctly", () => {
    const games = [
      game({ franchiseId: "a", seasonYear: 2024, week: 1, points: 130, opponentPoints: 100 }), // +30
      game({ franchiseId: "b", seasonYear: 2025, week: 1, points: 130, opponentPoints: 100 }), // +30, different season
      game({ franchiseId: "c", seasonYear: 2024, week: 1, points: 100, opponentPoints: 100 + 1 }), // no wins at all
    ];
    const margins = seasonMargins(games);
    const best = bestAvgMarginOfVictory(margins);
    expect(best.value).toBe(30);
    expect(best.holders.map((h) => h.franchiseId).sort()).toEqual(["a", "b"]);

    const worst = worstAvgMarginOfDefeat(margins);
    expect(worst.holders.map((h) => h.franchiseId)).toEqual(["c"]);
  });
});

describe("win/loss streaks", () => {
  it("finds the longest win streak within a single season", () => {
    const games = [
      game({ franchiseId: "a", week: 1, points: 100, opponentPoints: 90 }), // W
      game({ franchiseId: "a", week: 2, points: 100, opponentPoints: 90 }), // W
      game({ franchiseId: "a", week: 3, points: 80, opponentPoints: 90 }), // L, breaks streak
      game({ franchiseId: "a", week: 4, points: 100, opponentPoints: 90 }), // W
    ];
    const result = longestWinStreak(games);
    expect(result.value).toBe(2);
    expect(result.holders[0].context).toMatchObject({ startWeek: 1, endWeek: 2, crossSeason: false });
  });

  it("allows a streak to cross the season boundary and labels it crossSeason", () => {
    const games = [
      game({ franchiseId: "a", seasonYear: 2024, week: 14, points: 100, opponentPoints: 90 }), // W
      game({ franchiseId: "a", seasonYear: 2025, week: 1, points: 100, opponentPoints: 90 }), // W
      game({ franchiseId: "a", seasonYear: 2025, week: 2, points: 100, opponentPoints: 90 }), // W
    ];
    const result = longestWinStreak(games);
    expect(result.value).toBe(3);
    expect(result.holders[0].context).toMatchObject({
      startSeasonYear: 2024,
      startWeek: 14,
      endSeasonYear: 2025,
      endWeek: 2,
      crossSeason: true,
    });
  });

  it("treats a tie as breaking both a win streak and a losing streak", () => {
    const games = [
      game({ franchiseId: "a", week: 1, points: 100, opponentPoints: 90 }), // W
      game({ franchiseId: "a", week: 2, points: 100, opponentPoints: 100 }), // T
      game({ franchiseId: "a", week: 3, points: 100, opponentPoints: 90 }), // W
    ];
    const result = longestWinStreak(games);
    expect(result.value).toBe(1);
  });

  it("ties the longest losing streak across multiple franchises", () => {
    const games = [
      game({ franchiseId: "a", week: 1, points: 80, opponentPoints: 100 }),
      game({ franchiseId: "a", week: 2, points: 80, opponentPoints: 100 }),
      game({ franchiseId: "b", week: 1, points: 80, opponentPoints: 100 }),
      game({ franchiseId: "b", week: 2, points: 80, opponentPoints: 100 }),
    ];
    const result = longestLosingStreak(games);
    expect(result.value).toBe(2);
    expect(result.holders.map((h) => h.franchiseId).sort()).toEqual(["a", "b"]);
  });
});

describe("seasonAllPlayLuck", () => {
  it("normalizes beatCount by (fieldSize - 1) so it's comparable to a real win", () => {
    // Week 1 (3-team field, 2 possible opponents each):
    //   a=150 (beats b,c -> beatCount 2 -> 2/2 = 1.0)
    //   b=100 (beats c -> beatCount 1 -> 1/2 = 0.5)
    //   c=50  (beats none -> beatCount 0 -> 0/2 = 0.0)
    // Week 2:
    //   a=50  (beats none -> 0/2 = 0.0)
    //   b=100 (beats a,c -> 2/2 = 1.0)
    //   c=90  (beats a -> 1/2 = 0.5)
    const games = [
      game({ franchiseId: "a", week: 1, points: 150, opponentFranchiseId: "b", opponentPoints: 100 }),
      game({ franchiseId: "b", week: 1, points: 100, opponentFranchiseId: "a", opponentPoints: 150 }),
      game({ franchiseId: "c", week: 1, points: 50, opponentFranchiseId: "b", opponentPoints: 100 }),
      game({ franchiseId: "a", week: 2, points: 50, opponentFranchiseId: "c", opponentPoints: 90 }),
      game({ franchiseId: "b", week: 2, points: 100, opponentFranchiseId: "c", opponentPoints: 90 }),
      game({ franchiseId: "c", week: 2, points: 90, opponentFranchiseId: "a", opponentPoints: 50 }),
    ];
    const luck = seasonAllPlayLuck(games);
    const a = luck.find((l) => l.franchiseId === "a")!;
    expect(a.wouldBeWins).toBeCloseTo(1.0 + 0.0, 5); // week1: 1.0, week2: 0.0
    // a's actual record: week1 win (beat b head-to-head), week2 loss (lost to c) -> 1 actual win
    expect(a.actualWins).toBe(1);
    expect(a.luckGap).toBeCloseTo(1 - 1.0, 5);
  });

  it("counts a tied score as half a beat, and normalizes it the same way", () => {
    const games = [
      game({ franchiseId: "a", week: 1, points: 100, opponentFranchiseId: "b", opponentPoints: 100 }),
      game({ franchiseId: "b", week: 1, points: 100, opponentFranchiseId: "a", opponentPoints: 100 }),
    ];
    const luck = seasonAllPlayLuck(games);
    // Only 1 other franchise that week (fieldSize=2, fieldSize-1=1), so
    // a 0.5 beatCount normalizes to 0.5 would-be wins.
    expect(luck.find((l) => l.franchiseId === "a")?.wouldBeWins).toBe(0.5);
  });

  it("lets a dominant team's actual wins exceed its normalized all-play wins (lucky) in a large field", () => {
    // 4-team field (3 possible opponents each week). a wins its real
    // matchup every week but is the WEAKEST scorer of the 4 each week,
    // so its normalized all-play share is low relative to its 100%
    // actual win rate against its own (even weaker) opponent.
    const games = [
      game({ franchiseId: "a", seasonYear: 2024, week: 1, points: 60, opponentFranchiseId: "b", opponentPoints: 50 }),
      game({ franchiseId: "b", seasonYear: 2024, week: 1, points: 50, opponentFranchiseId: "a", opponentPoints: 60 }),
      game({ franchiseId: "c", seasonYear: 2024, week: 1, points: 200, opponentFranchiseId: "d", opponentPoints: 190 }),
      game({ franchiseId: "d", seasonYear: 2024, week: 1, points: 190, opponentFranchiseId: "c", opponentPoints: 200 }),
    ];
    const luck = seasonAllPlayLuck(games);
    const a = luck.find((l) => l.franchiseId === "a")!;
    // a beats only b (beatCount 1 of 3 possible) -> would-be wins 1/3.
    expect(a.wouldBeWins).toBeCloseTo(1 / 3, 5);
    expect(a.actualWins).toBe(1);
    expect(a.luckGap).toBeGreaterThan(0);

    const luckiest = luckiestSeason(luck);
    expect(luckiest.holders.map((h) => h.franchiseId)).toEqual(["a"]);
  });

  it("luckiestSeason and unluckiestSeason tie correctly across franchises", () => {
    const luck = [
      { franchiseId: "x", seasonYear: 2024, actualWins: 5, wouldBeWins: 3, luckGap: 2, weeklyDetail: [] },
      { franchiseId: "y", seasonYear: 2024, actualWins: 5, wouldBeWins: 3, luckGap: 2, weeklyDetail: [] },
      { franchiseId: "z", seasonYear: 2024, actualWins: 3, wouldBeWins: 8, luckGap: -5, weeklyDetail: [] },
    ];
    expect(luckiestSeason(luck).holders.map((h) => h.franchiseId).sort()).toEqual(["x", "y"]);
    expect(unluckiestSeason(luck).holders.map((h) => h.franchiseId)).toEqual(["z"]);
  });
});

describe("toughestSchedule / toughestScheduleAllTime", () => {
  it("sums each week's opponent's season total, not that week's opponent score", () => {
    const totals = [
      { franchiseId: "b", seasonYear: 2024, totalPoints: 1000 },
      { franchiseId: "c", seasonYear: 2024, totalPoints: 2000 },
    ];
    const games = [
      game({ franchiseId: "a", week: 1, opponentFranchiseId: "b", opponentPoints: 5 }),
      game({ franchiseId: "a", week: 2, opponentFranchiseId: "c", opponentPoints: 999 }),
    ];
    const [result] = toughestSchedule(games, totals);
    expect(result.opponentPointsSum).toBe(1000 + 2000);
  });

  it("returns co-holders when schedule difficulty is tied", () => {
    const totals = [{ franchiseId: "x", seasonYear: 2024, totalPoints: 500 }];
    const schedules = [
      { franchiseId: "a", seasonYear: 2024, opponentPointsSum: 500 },
      { franchiseId: "b", seasonYear: 2024, opponentPointsSum: 500 },
      { franchiseId: "c", seasonYear: 2024, opponentPointsSum: 300 },
    ];
    void totals; // not needed once schedules are precomputed; kept for readability of the fixture
    const result = toughestScheduleAllTime(schedules);
    expect(result.holders.map((h) => h.franchiseId).sort()).toEqual(["a", "b"]);
  });
});
