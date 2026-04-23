import { describe, expect, it } from "vitest";
import type {
  ChatMessage,
  ChatResult,
  IDatabaseManager,
  ToolHandler,
  ToolHandlersRegistry,
  ChatPerplexityArgs,
  ExtractUrlContentArgs,
  SearchArgs,
  ServerDependencies,
} from "../../types/index.js";

describe("Type Definitions", () => {
  describe("Database Types", () => {
    it("should define ChatMessage structure", () => {
      const message: ChatMessage = {
        role: "user",
        content: "Hello",
      };

      expect(message.role).toMatch(/^(user|assistant)$/);
      expect(message.content).toBeTypeOf("string");
    });

    it("should define ChatResult structure", () => {
      const result: ChatResult = {
        chat_id: "test-chat-id",
        response: "Test response",
      };

      expect(result.chat_id).toBeTypeOf("string");
      expect(result.response).toBeTypeOf("string");
    });

    it("should define IDatabaseManager interface", () => {
      const dbManager: IDatabaseManager = {
        initialize: () => {},
        getChatHistory: () => [],
        saveChatMessage: () => {},
        close: () => {},
        isInitialized: () => true,
      };

      expect(dbManager).toBeDefined();
    });
  });

  describe("Tool Types", () => {
    it("should define ToolHandler type", () => {
      const handler: ToolHandler = async () => "result";
      expect(handler).toBeTypeOf("function");
    });

    it("should define ToolHandlersRegistry structure", () => {
      const registry: ToolHandlersRegistry = {
        chat_perplexity: async () => "result",
        search: async () => "result",
      };

      expect(registry).toBeDefined();
    });

    it("should define argument types", () => {
      const chatArgs: ChatPerplexityArgs = {
        message: "test message",
      };

      const extractArgs: ExtractUrlContentArgs = {
        url: "https://example.com",
      };

      const searchArgs: SearchArgs = {
        query: "test query",
        detail_level: "normal",
      };

      expect(chatArgs.message).toBeTypeOf("string");
      expect(extractArgs.url).toBeTypeOf("string");
      expect(searchArgs.query).toBeTypeOf("string");
    });
  });

  describe("Server Types", () => {
    it("should define ServerDependencies structure", () => {
      const dependencies: ServerDependencies = {
        apiClient: undefined,
        databaseManager: undefined,
      };

      expect(dependencies).toBeDefined();
    });
  });
});
