import "server-only";
import { createEspnProvider } from "./index";

/**
 * Makes one lightweight authenticated call and returns false on
 * failure (HTTP 401). The weekly sync job (Phase 2.3) must run this
 * first and, on failure, write a stale flag and stop rather than
 * silently serving old numbers (see the Fantasy League HQ spec §4.3
 * and §10).
 */
export async function checkEspnCredentials(): Promise<boolean> {
  const provider = createEspnProvider();
  return provider.checkCredentials();
}
