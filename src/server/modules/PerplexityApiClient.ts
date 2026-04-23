import axios from "axios";
import { logError, logInfo } from "../../utils/logging.js";
import { CONFIG } from "../config.js";

export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class PerplexityApiClient {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.perplexity.ai";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || CONFIG.API_KEY;
    if (!this.apiKey) {
      throw new Error("PERPLEXITY_API_KEY environment variable is required");
    }
  }

  async chatCompletion(
    messages: ChatCompletionMessage[],
    options?: { model?: string; temperature?: number; maxTokens?: number },
  ): Promise<string> {
    const model = options?.model || CONFIG.DEFAULT_MODEL;

    logInfo(`Calling Perplexity API with model: ${model}`);

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model,
          messages,
          temperature: options?.temperature ?? 0.2,
          max_tokens: options?.maxTokens ?? 4000,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 120000,
        },
      );

      const content = response.data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from Perplexity API");
      }

      logInfo(`Perplexity API response received (${content.length} chars)`);
      return content;
    } catch (error) {
      logError("Perplexity API request failed:", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
