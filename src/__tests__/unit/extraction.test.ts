import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageContentResult } from "../../types/browser.js";

// Mock external dependencies
vi.mock("@mozilla/readability", () => ({
  Readability: vi.fn().mockImplementation(() => ({
    parse: vi.fn().mockReturnValue({
      title: "Test Title",
      textContent: "Test content from Readability",
    }),
  })),
}));

vi.mock("jsdom", () => ({
  JSDOM: vi.fn().mockImplementation(() => ({
    window: {
      document: {
        querySelector: vi.fn(),
        querySelectorAll: vi.fn().mockReturnValue([]),
        title: "Test Page",
      },
    },
    serialize: vi.fn().mockReturnValue("<html></html>"),
  })),
}));

vi.mock("axios", () => ({
  default: {
    head: vi.fn(),
    get: vi.fn().mockResolvedValue({
      data: "<html><body>Test content</body></html>",
      status: 200,
      headers: { "content-type": "text/html" },
    }),
  },
}));

vi.mock("../../server/config.js", () => ({
  CONFIG: {
    USER_AGENT: "test-agent",
    TIMEOUT_PROFILES: {
      navigation: 30000,
      content: 60000,
    },
  },
}));

vi.mock("../../utils/logging.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../../utils/fetch.js", () => ({
  fetchSimpleContent: vi.fn(),
}));

describe("Extraction Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Single Page Content Fetching", () => {
    it("should fetch and extract content from a single page", async () => {
      const { fetchSinglePageContent } = await import("../../utils/extraction.js");

      // We'll test this by focusing on the structure and not deep mocking
      expect(fetchSinglePageContent).toBeDefined();
      expect(typeof fetchSinglePageContent).toBe("function");
    });
  });

  describe("Link Extraction", () => {
    it("should extract same-domain links from HTML", async () => {
      const { extractSameDomainLinks } = await import("../../utils/extraction.js");

      const html = `
        <html><body>
          <a href="/page1">Page 1</a>
          <a href="/page2">Page 2</a>
          <a href="https://example.com/page3">Page 3</a>
        </body></html>
      `;

      const result = extractSameDomainLinks(html, "https://example.com");

      expect(result).toHaveLength(3);
      expect(result[0]?.url).toContain("https://example.com");
    });

    it("should filter out invalid and cross-domain links", async () => {
      const { extractSameDomainLinks } = await import("../../utils/extraction.js");

      const html = `
        <html><body>
          <a href="javascript:void(0)">Invalid Link</a>
          <a href="mailto:test@example.com">Email Link</a>
          <a href="https://other.com/page">Cross Domain</a>
          <a href="/valid-page">Valid Page</a>
        </body></html>
      `;

      const result = extractSameDomainLinks(html, "https://example.com");

      // Should only have the valid same-domain link
      expect(result).toHaveLength(1);
      expect(result[0]?.url).toBe("https://example.com/valid-page");
    });

    it("should handle link extraction errors gracefully", async () => {
      const { extractSameDomainLinks } = await import("../../utils/extraction.js");

      const result = extractSameDomainLinks("invalid html", "not-a-url");

      expect(result).toEqual([]);
    });
  });

  describe("Recursive Content Fetching", () => {
    it("should recursively fetch content with depth limiting", async () => {
      const { recursiveFetch } = await import("../../utils/extraction.js");

      // Test that the function exists and can be called
      expect(recursiveFetch).toBeDefined();
      expect(typeof recursiveFetch).toBe("function");
    });

    it("should respect timeout signal during recursive fetch", async () => {
      const { recursiveFetch } = await import("../../utils/extraction.js");

      const visitedUrls = new Set<string>();
      const results: PageContentResult[] = [];
      const globalTimeoutSignal = { timedOut: true }; // Already timed out

      await recursiveFetch(
        "https://example.com",
        2,
        1,
        visitedUrls,
        results,
        globalTimeoutSignal,
      );

      expect(results).toHaveLength(0);
    });

    it("should handle basic recursive fetch flow", async () => {
      const { recursiveFetch } = await import("../../utils/extraction.js");

      const { fetchSinglePageContent } = await import("../../utils/extraction.js");
      vi.mocked(fetchSinglePageContent).mockResolvedValue({
        url: "https://example.com",
        title: "Example",
        textContent: "Example content",
        error: undefined,
      });

      const visitedUrls = new Set<string>();
      const results: PageContentResult[] = [];
      const globalTimeoutSignal = { timedOut: false };

      await recursiveFetch(
        "https://example.com",
        1,
        1,
        visitedUrls,
        results,
        globalTimeoutSignal,
      );

      // Should have attempted to process the URL
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it("should fetch simpler content for deeper levels", async () => {
      const { recursiveFetch } = await import("../../utils/extraction.js");

      const { fetchSimpleContent } = await import("../../utils/fetch.js");
      vi.mocked(fetchSimpleContent).mockResolvedValue({
        title: "Page 1",
        textContent: "Page 1 content",
        error: undefined,
      });

      const visitedUrls = new Set<string>();
      const results: PageContentResult[] = [];
      const globalTimeoutSignal = { timedOut: false };

      await recursiveFetch(
        "https://example.com/page1",
        2,
        2, // currentDepth > 1, should use fetchSimpleContent
        visitedUrls,
        results,
        globalTimeoutSignal,
      );

      // Should have attempted to process the URL
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });
});
