import { homedir } from "node:os";
import { join } from "node:path";

export const CONFIG = {
  // Perplexity API settings
  API_KEY: process.env["PERPLEXITY_API_KEY"] || "",
  DEFAULT_MODEL: process.env["PERPLEXITY_MODEL"] || "sonar-pro",

  // Data directory for chat history database
  DATA_DIR: process.env["PERPLEXITY_DATA_DIR"] || join(homedir(), ".perplexity-mcp"),

  // Timeouts
  API_TIMEOUT: 120000,
  MCP_TIMEOUT_BUFFER: 60000,

  USER_AGENT:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",

  TIMEOUT_PROFILES: {
    navigation: 45000,
    content: 120000,
    recovery: 30000,
  },

  DEBUG: {
    CAPTURE_SCREENSHOTS: false,
    MAX_SCREENSHOTS: 5,
    SCREENSHOT_ON_RECOVERY_SUCCESS: false,
  },
} as const;
