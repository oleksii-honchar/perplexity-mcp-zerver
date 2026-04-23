import { homedir } from "node:os";
import { join } from "node:path";

export const CONFIG = {
  // Perplexity API configuration
  API_KEY: process.env["PERPLEXITY_API_KEY"] || "",
  BASE_URL: "https://api.perplexity.ai",
  DEFAULT_MODEL: process.env["PERPLEXITY_MODEL"] || "sonar-pro",

  // Request settings
  REQUEST_TIMEOUT: 120000, // 2 minutes
  MAX_RETRIES: 3,
  MCP_TIMEOUT_BUFFER: 60000,

  // Content extraction settings
  USER_AGENT:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  TIMEOUT_PROFILES: {
    navigation: 45000,
    content: 120000,
  },

  // Database
  DATABASE_PATH: process.env["PERPLEXITY_DB_PATH"] || join(homedir(), ".perplexity-mcp", "chat_history.db"),

  DEBUG: {
    CAPTURE_SCREENSHOTS: false,
    MAX_SCREENSHOTS: 5,
  },
} as const;
