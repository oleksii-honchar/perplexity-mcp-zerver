import { describe, expect, it } from "vitest";
import { CONFIG } from "../../server/config.js";

describe("Configuration", () => {
  describe("Timeout Values", () => {
    it("should have consistent timeout values", () => {
      expect(CONFIG.REQUEST_TIMEOUT).toBeGreaterThan(0);
      expect(CONFIG.MCP_TIMEOUT_BUFFER).toBeGreaterThan(0);
    });

    it("should have reasonable timeout relationships", () => {
      // Request timeout should be greater than MCP buffer
      expect(CONFIG.REQUEST_TIMEOUT).toBeGreaterThan(CONFIG.MCP_TIMEOUT_BUFFER);

      // Request timeout should be substantial for API calls
      expect(CONFIG.REQUEST_TIMEOUT).toBeGreaterThan(30000);
    });
  });

  describe("User Agent", () => {
    it("should have valid user agent string", () => {
      expect(typeof CONFIG.USER_AGENT).toBe("string");
      expect(CONFIG.USER_AGENT.length).toBeGreaterThan(0);
      expect(CONFIG.USER_AGENT).toContain("Mozilla");
      expect(CONFIG.USER_AGENT).toContain("Chrome");
    });
  });

  describe("Retry Configuration", () => {
    it("should have reasonable retry limits", () => {
      expect(CONFIG.MAX_RETRIES).toBeGreaterThan(0);
      expect(CONFIG.MAX_RETRIES).toBeLessThan(20);
    });
  });

  describe("Timeout Profiles", () => {
    it("should have valid timeout profiles", () => {
      expect(CONFIG.TIMEOUT_PROFILES).toBeDefined();
      expect(CONFIG.TIMEOUT_PROFILES.navigation).toBeGreaterThan(0);
      expect(CONFIG.TIMEOUT_PROFILES.content).toBeGreaterThan(0);
    });

    it("should have consistent timeout profile relationships", () => {
      // Navigation timeout should be substantial
      expect(CONFIG.TIMEOUT_PROFILES.navigation).toBeGreaterThan(30000);

      // Content timeout should be the longest
      expect(CONFIG.TIMEOUT_PROFILES.content).toBeGreaterThan(CONFIG.TIMEOUT_PROFILES.navigation);
    });
  });

  describe("Debug Configuration", () => {
    it("should have valid debug settings", () => {
      expect(typeof CONFIG.DEBUG.CAPTURE_SCREENSHOTS).toBe("boolean");
      expect(CONFIG.DEBUG.MAX_SCREENSHOTS).toBeGreaterThan(0);
    });
  });

  describe("API Configuration", () => {
    it("should have valid API settings", () => {
      expect(CONFIG.BASE_URL).toBe("https://api.perplexity.ai");
      expect(typeof CONFIG.DEFAULT_MODEL).toBe("string");
      expect(CONFIG.DEFAULT_MODEL.length).toBeGreaterThan(0);
    });
  });
});
