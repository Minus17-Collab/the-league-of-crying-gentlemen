import type { ScoringRule, StatLine } from "./types";

/**
 * The one scoring function (see AGENTS.md "Scoring is data, never
 * code"). Pure — no I/O, no database calls. Fantasy points are
 * computed by joining stat lines against the scoring rules for the
 * relevant season; no point value is ever hardcoded here.
 *
 * Rounding is a display concern, never a storage or computation one
 * (see AGENTS.md "Conventions") — this function returns the full
 * unrounded total.
 */
export function computePoints(
  statLines: StatLine[],
  rules: ScoringRule[],
): number {
  let total = 0;

  for (const line of statLines) {
    for (const rule of rules) {
      if (rule.statKey !== line.statKey) continue;
      if (!ruleAppliesToPosition(rule, line.position)) continue;

      total += rule.pointsPerUnit * line.value;

      if (thresholdSatisfied(rule, line.value)) {
        total += rule.flatBonus;
      }
    }
  }

  return total;
}

function ruleAppliesToPosition(
  rule: ScoringRule,
  position: string | undefined,
): boolean {
  if (!rule.positionFilter || rule.positionFilter.length === 0) return true;
  if (!position) return false;
  return rule.positionFilter.includes(position);
}

function thresholdSatisfied(rule: ScoringRule, value: number): boolean {
  if (rule.minValue == null && rule.maxValue == null) return true;
  if (rule.minValue != null && value < rule.minValue) return false;
  if (rule.maxValue != null && value > rule.maxValue) return false;
  return true;
}
