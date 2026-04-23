/**
 * Server module and dependency injection type definitions
 */
import type { PerplexityApiClient } from "../server/modules/PerplexityApiClient.js";
import type { IDatabaseManager } from "./database.js";
import type { ISearchEngine } from "./tools.js";

// ─── SERVER DEPENDENCY INJECTION ──────────────────────────────────────
export interface ServerDependencies {
  apiClient?: PerplexityApiClient;
  searchEngine?: ISearchEngine;
  databaseManager?: IDatabaseManager;
}
