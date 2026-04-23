import axios from "axios";
import { CONFIG } from "../config.js";
import { logError, logInfo } from "../../utils/logging.js";

export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PerplexityApiClientOptions {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

export class PerplexityApiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: PerplexityApiClientOptions = {}) {
    this.apiKey = options.apiKey || CONFIG.API_KEY;
    this.baseUrl = options.baseUrl || CONFIG.BASE_URL;

    if (!this.apiKey) {
      throw new Error(
        "PERPLEXITY_API_KEY environment variable is required. " +
          "Get your API key at https://www.perplexity.ai/settings/api",
      );
    }
  }

  async chatCompletion(
    messages: ChatCompletionMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
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
          timeout: CONFIG.REQUEST_TIMEOUT,
        },
      );

      const content = response.data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from Perplexity API");
      }

      logInfo(`Perplexity API response received (${content.length} chars)`);
      return content;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const detail = error.response?.data?.error?.message || error.message;
        logError(`Perplexity API error (${status}): ${detail}`);
        throw new Error(`Perplexity API error (${status}): ${detail}`);
      }
      logError("Perplexity API request failed:", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
