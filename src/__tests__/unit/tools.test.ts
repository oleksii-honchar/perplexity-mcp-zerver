import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageContentResult } from "../../types/browser.js";
import type { ChatMessage } from "../../types/database.js";

// Mock PerplexityApiClient
const mockChatCompletion = vi.fn();
const MockPerplexityApiClient = vi.fn().mockImplementation(() => ({
  chatCompletion: mockChatCompletion,
}));

vi.mock("../../server/modules/PerplexityApiClient.js", () => ({
  PerplexityApiClient: MockPerplexityApiClient,
}));

// Mock Mozilla Readability
vi.mock("@mozilla/readability", () => ({
  Readability: vi.fn(),
}));

// Mock JSDOM
vi.mock("jsdom", () => ({
  JSDOM: vi.fn(),
}));

// Mock logging
vi.mock("../../utils/logging.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

// Mock database utilities
const mockGetChatHistory = vi.fn();
const mockSaveChatMessage = vi.fn();
vi.mock("../../utils/db.js", () => ({
  initializeDatabase: vi.fn(),
  getChatHistory: () => mockGetChatHistory(),
  saveChatMessage: () => mockSaveChatMessage(),
}));

// Mock extraction utilities
const mockExtraction = vi.hoisted(() => ({
  fetchSinglePageContent: vi.fn(),
  recursiveFetch: vi.fn(),
  extractSameDomainLinks: vi.fn(),
}));
vi.mock("../../utils/extraction.js", () => mockExtraction);

// Mock fetch utilities
vi.mock("../../utils/fetch.js", () => ({
  fetchSimpleContent: vi.fn(),
}));

const mockApiClient = new MockPerplexityApiClient();

describe("Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChatCompletion.mockReset();
  });

  describe("chatPerplexity", () => {
    it("should handle basic chat functionality with new chat_id", async () => {
      const { default: chatPerplexity } = await import("../../tools/chatPerplexity.js");

      mockGetChatHistory.mockReturnValue([]);
      mockChatCompletion.mockResolvedValue("Mock response");

      const args = { message: "Hello, world!" };
      const result = await chatPerplexity(
        args,
        mockApiClient,
        mockGetChatHistory,
        mockSaveChatMessage,
      );

      expect(mockGetChatHistory).toHaveBeenCalled();
      expect(mockSaveChatMessage).toHaveBeenCalled();
      expect(mockChatCompletion).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "Hello, world!" }),
        ]),
      );
      expect(result).toBe("Mock response");
    });

    it("should handle chat with existing chat_id and history", async () => {
      const { default: chatPerplexity } = await import("../../tools/chatPerplexity.js");

      mockGetChatHistory.mockReturnValue([
        { role: "user", content: "Previous message" } as ChatMessage,
        { role: "assistant", content: "Previous response" } as ChatMessage,
      ]);
      mockChatCompletion.mockResolvedValue("New response");

      const args = { message: "New message", chat_id: "test-chat-id" };
      const result = await chatPerplexity(
        args,
        mockApiClient,
        mockGetChatHistory,
        mockSaveChatMessage,
      );

      expect(mockGetChatHistory).toHaveBeenCalledWith("test-chat-id");
      expect(mockChatCompletion).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "Previous message" }),
          expect.objectContaining({ role: "assistant", content: "Previous response" }),
          expect.objectContaining({ role: "user", content: "New message" }),
        ]),
      );
      expect(result).toBe("New response");
    });

    it("should handle empty message gracefully", async () => {
      const { default: chatPerplexity } = await import("../../tools/chatPerplexity.js");

      mockGetChatHistory.mockReturnValue([]);
      mockChatCompletion.mockResolvedValue("Response to empty message");

      const args = { message: "" };
      const result = await chatPerplexity(
        args,
        mockApiClient,
        mockGetChatHistory,
        mockSaveChatMessage,
      );

      expect(mockChatCompletion).toHaveBeenCalled();
      expect(result).toBe("Response to empty message");
    });
  });

  describe("search", () => {
    it("should handle normal detail level search", async () => {
      const { default: search } = await import("../../tools/search.js");

      mockChatCompletion.mockResolvedValue("Normal search result");

      const args = { query: "test query", detail_level: "normal" as const };
      const result = await search(args, mockApiClient);

      expect(mockChatCompletion).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("Provide a clear, balanced answer to: test query"),
          }),
        ]),
      );
      expect(result).toBe("Normal search result");
    });

    it("should handle brief detail level search", async () => {
      const { default: search } = await import("../../tools/search.js");

      mockChatCompletion.mockResolvedValue("Brief search result");

      const args = { query: "test query", detail_level: "brief" as const };
      const result = await search(args, mockApiClient);

      expect(mockChatCompletion).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("Provide a brief, concise answer to: test query"),
          }),
        ]),
      );
      expect(result).toBe("Brief search result");
    });

    it("should handle detailed detail level search", async () => {
      const { default: search } = await import("../../tools/search.js");

      mockChatCompletion.mockResolvedValue("Detailed search result");

      const args = { query: "test query", detail_level: "detailed" as const };
      const result = await search(args, mockApiClient);

      expect(mockChatCompletion).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining(
              "Provide a comprehensive, detailed analysis of: test query",
            ),
          }),
        ]),
      );
      expect(result).toBe("Detailed search result");
    });

    it("should handle search with default parameters", async () => {
      const { default: search } = await import("../../tools/search.js");

      mockChatCompletion.mockResolvedValue("Default search result");

      const args = { query: "test query" };
      const result = await search(args, mockApiClient);

      expect(mockChatCompletion).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("Provide a clear, balanced answer to: test query"),
          }),
        ]),
      );
      expect(result).toBe("Default search result");
    });
  });

  describe("extractUrlContent", () => {
    it("should handle single page extraction", async () => {
      const { default: extractUrlContent } = await import("../../tools/extractUrlContent.js");

      const mockResult: PageContentResult = {
        url: "https://example.com",
        title: "Example Page",
        textContent: "Example content",
        error: null,
      };

      mockExtraction.fetchSinglePageContent.mockResolvedValue(mockResult);

      const args = { url: "https://example.com", depth: 1 };
      const result = await extractUrlContent(args);

      // For depth=1, it should return the result directly as JSON
      const parsedResult = JSON.parse(result);
      expect(parsedResult.url).toBe("https://example.com");
      expect(parsedResult.textContent).toBe("Example content");
    });

    it("should handle recursive extraction with depth > 1", async () => {
      const { default: extractUrlContent } = await import("../../tools/extractUrlContent.js");

      const mockResults: PageContentResult[] = [
        {
          url: "https://example.com",
          title: "Example Page",
          textContent: "Example content",
          error: null,
        },
      ];

      mockExtraction.recursiveFetch.mockImplementation(async (_, __, ___, ____, results: PageContentResult[]) => {
        results.push(...mockResults);
      });

      const args = { url: "https://example.com", depth: 2 };
      const result = await extractUrlContent(args);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.explorationDepth).toBe(2);
      expect(parsedResult.pagesExplored).toBe(1);
      expect(parsedResult.rootUrl).toBe("https://example.com");
    });

    it("should handle GitHub URL rewriting", async () => {
      const { default: extractUrlContent } = await import("../../tools/extractUrlContent.js");

      const mockResult: PageContentResult = {
        url: "https://github.com/user/repo",
        title: "GitHub Repository",
        textContent: "Repository content",
        error: null,
      };

      mockExtraction.fetchSinglePageContent.mockResolvedValue(mockResult);

      const args = { url: "https://github.com/user/repo", depth: 1 };
      const result = await extractUrlContent(args);

      // For GitHub URLs with depth=1, it should still return the result directly
      const parsedResult = JSON.parse(result);
      expect(parsedResult.url).toBe("https://github.com/user/repo");
      expect(parsedResult.textContent).toBe("Repository content");
    });

    it("should handle extraction errors gracefully", async () => {
      const { default: extractUrlContent } = await import("../../tools/extractUrlContent.js");

      // Mock fetchSinglePageContent to return an error result, not throw
      mockExtraction.fetchSinglePageContent.mockResolvedValue({
        url: "https://invalid-url.com",
        error: "Network error",
      });

      const args = { url: "https://invalid-url.com", depth: 1 };

      // The function should catch the error and return it in the result, not throw
      const result = await extractUrlContent(args);

      // For depth=1, errors should be returned in the result object
      const parsedResult = JSON.parse(result);
      expect(parsedResult.error).toContain("Network error");
    });

    it("should validate depth parameter boundaries", async () => {
      const { default: extractUrlContent } = await import("../../tools/extractUrlContent.js");

      const mockResult: PageContentResult = {
        url: "https://example.com",
        title: "Example Page",
        textContent: "Example content",
        error: null,
      };

      mockExtraction.fetchSinglePageContent.mockResolvedValue(mockResult);

      // Test depth clamping - should be max 5
      const args = { url: "https://example.com", depth: 10 };
      const result = await extractUrlContent(args);

      // For depth > 1, it should return the formatted result object
      const parsedResult = JSON.parse(result);
      expect(parsedResult.explorationDepth).toBe(5); // Max depth should be 5
    });
  });

  describe("getDocumentation", () => {
    it("should handle basic documentation query", async () => {
      const { default: getDocumentation } = await import("../../tools/getDocumentation.js");

      mockChatCompletion.mockResolvedValue("Documentation result");

      const args = { query: "React hooks" };
      const result = await getDocumentation(args, mockApiClient);

      expect(mockChatCompletion).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining(
              "Provide comprehensive documentation and usage examples for React hooks",
            ),
          }),
        ]),
      );
      expect(result).toBe("Documentation result");
    });

    it("should handle documentation query with context", async () => {
      const { default: getDocumentation } = await import("../../tools/getDocumentation.js");

      mockChatCompletion.mockResolvedValue("Documentation with context result");

      const args = { query: "React hooks", context: "focus on performance optimization" };
      const result = await getDocumentation(args, mockApiClient);

      expect(mockChatCompletion).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("Focus on: focus on performance optimization"),
          }),
        ]),
      );
      expect(result).toBe("Documentation with context result");
    });
  });

  describe("findApis", () => {
    it("should handle API discovery query", async () => {
      const { default: findApis } = await import("../../tools/findApis.js");

      mockChatCompletion.mockResolvedValue("API discovery result");

      const args = { requirement: "image recognition" };
      const result = await findApis(args, mockApiClient);

      expect(mockChatCompletion).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining(
              "Find and evaluate APIs that could be used for: image recognition",
            ),
          }),
        ]),
      );
      expect(result).toBe("API discovery result");
    });

    it("should handle API discovery with context", async () => {
      const { default: findApis } = await import("../../tools/findApis.js");

      mockChatCompletion.mockResolvedValue("API discovery with context result");

      const args = { requirement: "payment processing", context: "prefer free tier options" };
      const result = await findApis(args, mockApiClient);

      expect(mockChatCompletion).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("Context: prefer free tier options"),
          }),
        ]),
      );
      expect(result).toBe("API discovery with context result");
    });
  });

  describe("checkDeprecatedCode", () => {
    it("should handle deprecated code checking", async () => {
      const { default: checkDeprecatedCode } = await import("../../tools/checkDeprecatedCode.js");

      mockChatCompletion.mockResolvedValue("Deprecation check result");

      const args = { code: "componentWillMount()" };
      const result = await checkDeprecatedCode(args, mockApiClient);

      expect(mockChatCompletion).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("componentWillMount()"),
          }),
        ]),
      );
      expect(result).toBe("Deprecation check result");
    });

    it("should handle deprecated code checking with technology context", async () => {
      const { default: checkDeprecatedCode } = await import("../../tools/checkDeprecatedCode.js");

      mockChatCompletion.mockResolvedValue("Deprecation check with tech context result");

      const args = { code: "var instead of let/const", technology: "React 16" };
      const result = await checkDeprecatedCode(args, mockApiClient);

      expect(mockChatCompletion).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("var instead of let/const"),
          }),
        ]),
      );
      expect(result).toBe("Deprecation check with tech context result");
    });
  });
});
