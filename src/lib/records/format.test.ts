import { describe, expect, it } from "vitest";
import { formatRecordValue, formatContextNumber, formatCount } from "./format";

describe("formatRecordValue", () => {
  it("formats streak keys as whole numbers, no decimals", () => {
    expect(formatRecordValue("alltime_longest_win_streak", 9)).toBe("9");
    expect(formatRecordValue("alltime_longest_losing_streak", 5)).toBe("5");
    expect(formatRecordValue("season_longest_win_streak", 9)).toBe("9");
  });

  it("formats luck keys as signed wins with two decimals", () => {
    expect(formatRecordValue("alltime_luckiest_season", 1.333)).toBe("+1.33 wins");
    expect(formatRecordValue("alltime_unluckiest_season", -1.444)).toBe("-1.44 wins");
    expect(formatRecordValue("season_luck_score", 0)).toBe("0.00 wins");
  });

  it("formats point/margin/schedule values with two decimals and a thousands separator", () => {
    expect(formatRecordValue("alltime_highest_scoring_season", 1234.5)).toBe("1,234.50");
    expect(formatRecordValue("alltime_toughest_schedule", 23286.18)).toBe("23,286.18");
    expect(formatRecordValue("alltime_best_avg_margin_of_victory", 12.3)).toBe("12.30");
  });
});

describe("formatContextNumber", () => {
  it("formats to a fixed number of decimals", () => {
    expect(formatContextNumber(8.333, 1)).toBe("8.3");
    expect(formatContextNumber(8)).toBe("8.0");
  });
});

describe("formatCount", () => {
  it("formats whole numbers with a thousands separator", () => {
    expect(formatCount(12)).toBe("12");
    expect(formatCount(1234)).toBe("1,234");
  });
});
