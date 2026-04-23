/**
 * Server module and dependency injection type definitions
 */
import type { IDatabaseManager } from "./database.js";
import type { PerplexityApiClient } from "../server/modules/PerplexityApiClient.js";

// ─── SERVER DEPENDENCY INJECTION ──────────────────────────────────────
export interface ServerDependencies {
  apiClient?: PerplexityApiClient;
  databaseManager?: IDatabaseManager;
}
