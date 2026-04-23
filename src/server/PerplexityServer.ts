/**
 * PerplexityServer - API-based MCP server
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { IDatabaseManager, ServerDependencies } from "../types/index.js";
import { logError, logInfo } from "../utils/logging.js";
import { DatabaseManager } from "./modules/DatabaseManager.js";
import { PerplexityApiClient } from "./modules/PerplexityApiClient.js";
import { createToolHandlersRegistry, setupToolHandlers } from "./toolHandlerSetup.js";

// Import modular tool implementations
import chatPerplexity from "../tools/chatPerplexity.js";
import checkDeprecatedCode from "../tools/checkDeprecatedCode.js";
import extractUrlContent from "../tools/extractUrlContent.js";
import findApis from "../tools/findApis.js";
import getDocumentation from "../tools/getDocumentation.js";
import search from "../tools/search.js";

export class PerplexityServer {
  private readonly server: Server;
  private readonly apiClient: PerplexityApiClient;
  private readonly databaseManager: IDatabaseManager;

  constructor(dependencies?: ServerDependencies) {
    try {
      // Initialize MCP Server
      this.server = new Server(
        { name: "perplexity-server", version: "0.4.0" },
        {
          capabilities: {
            tools: {
              listChanged: true,
            },
          },
        },
      );

      // Initialize API client
      this.apiClient = dependencies?.apiClient ?? new PerplexityApiClient();

      // Initialize database
      this.databaseManager = dependencies?.databaseManager ?? new DatabaseManager();
      this.databaseManager.initialize();

      // Setup tool handlers
      this.setupToolHandlers();

      // Setup graceful shutdown
      // biome-ignore lint/complexity/useLiteralKeys: Environment variable access
      if (!process.env["MCP_MODE"] && !process.env["VITEST"]) {
        this.setupShutdownHandler();
      }

      logInfo("PerplexityServer initialized successfully");
    } catch (error) {
      logError("Error in PerplexityServer constructor:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  private setupShutdownHandler(): void {
    process.on("SIGINT", async () => {
      logInfo("SIGINT received, shutting down gracefully...");
      try {
        await this.cleanup();
        await this.server.close();
        process.exit(0);
      } catch (error) {
        logError("Error during shutdown:", {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      }
    });
  }

  private async cleanup(): Promise<void> {
    try {
      this.databaseManager.close();
      logInfo("Server cleanup completed");
    } catch (error) {
      logError("Error during cleanup:", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleChatPerplexity(args: Record<string, unknown>): Promise<string> {
    const typedArgs = args as { message: string; chat_id?: string };

    const getChatHistoryFn = (chatId: string) => this.databaseManager.getChatHistory(chatId);
    const saveChatMessageFn = (chatId: string, message: { role: "user" | "assistant"; content: string }) =>
      this.databaseManager.saveChatMessage(chatId, message.role, message.content);

    return await chatPerplexity(typedArgs, this.apiClient, getChatHistoryFn, saveChatMessageFn);
  }

  private async handleGetDocumentation(args: Record<string, unknown>): Promise<string> {
    const typedArgs = args as { query: string; context?: string };
    return await getDocumentation(typedArgs, this.apiClient);
  }

  private async handleFindApis(args: Record<string, unknown>): Promise<string> {
    const typedArgs = args as { requirement: string; context?: string };
    return await findApis(typedArgs, this.apiClient);
  }

  private async handleCheckDeprecatedCode(args: Record<string, unknown>): Promise<string> {
    const typedArgs = args as { code: string; technology?: string };
    return await checkDeprecatedCode(typedArgs, this.apiClient);
  }

  private async handleSearch(args: Record<string, unknown>): Promise<string> {
    const typedArgs = args as {
      query: string;
      detail_level?: "brief" | "normal" | "detailed";
      stream?: boolean;
    };

    return await search(typedArgs, this.apiClient);
  }

  private async handleExtractUrlContent(args: Record<string, unknown>): Promise<string> {
    const typedArgs = args as { url: string; depth?: number };
    return await extractUrlContent(typedArgs);
  }

  private setupToolHandlers(): void {
    const toolHandlers = createToolHandlersRegistry({
      chat_perplexity: this.handleChatPerplexity.bind(this),
      get_documentation: this.handleGetDocumentation.bind(this),
      find_apis: this.handleFindApis.bind(this),
      check_deprecated_code: this.handleCheckDeprecatedCode.bind(this),
      search: this.handleSearch.bind(this),
      extract_url_content: this.handleExtractUrlContent.bind(this),
    });

    setupToolHandlers(this.server, toolHandlers);
  }

  async run(): Promise<void> {
    try {
      logInfo("Creating StdioServerTransport...");
      const transport = new StdioServerTransport();

      logInfo("Starting PerplexityServer...");
      logInfo(`Tools registered: ${Object.keys(this.getToolHandlersRegistry()).join(", ")}`);

      logInfo("Attempting to connect server to transport...");
      await this.server.connect(transport);
      logInfo("PerplexityServer connected and ready");
      logInfo("Server is listening for requests...");

      // Keep the process alive
      process.stdin.resume();
    } catch (error) {
      logError("Failed to start server:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      process.exit(1);
    }
  }

  private getToolHandlersRegistry() {
    return {
      chat_perplexity: this.handleChatPerplexity.bind(this),
      get_documentation: this.handleGetDocumentation.bind(this),
      find_apis: this.handleFindApis.bind(this),
      check_deprecated_code: this.handleCheckDeprecatedCode.bind(this),
      search: this.handleSearch.bind(this),
      extract_url_content: this.handleExtractUrlContent.bind(this),
    };
  }

  // Getters for testing
  public getApiClient(): PerplexityApiClient {
    return this.apiClient;
  }

  public getDatabaseManager(): IDatabaseManager {
    return this.databaseManager;
  }
}
