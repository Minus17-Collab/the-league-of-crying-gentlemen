import "server-only";
import type { StatProvider } from "./types";
import { createEspnProvider } from "./espn";

/**
 * The only place a StatProvider implementation is chosen. Sync jobs
 * and Route Handlers call getStatProvider(); nothing else may import
 * lib/providers/espn (or sleeper/tank01, once they exist) directly
 * (see AGENTS.md "Stat providers are swappable").
 */
export function getStatProvider(): StatProvider {
  const provider = process.env.STAT_PROVIDER ?? "espn";

  switch (provider) {
    case "espn":
      return createEspnProvider();
    case "sleeper":
      throw new Error(
        "STAT_PROVIDER=sleeper is not implemented yet (see ROADMAP.md Phase 5.1).",
      );
    case "tank01":
      throw new Error(
        "STAT_PROVIDER=tank01 is not implemented yet (see ROADMAP.md Phase 5.1).",
      );
    default:
      throw new Error(`Unknown STAT_PROVIDER: "${provider}"`);
  }
}

export type {
  StatProvider,
  NormalizedPlayer,
  NormalizedStatLine,
  NormalizedTeam,
  NormalizedMatchup,
  NormalizedRosterEntry,
  NormalizedDraftPick,
  NormalizedTransaction,
} from "./types";
