/**
 * Tool implementation for web search functionality
 */

import type { PerplexityApiClient } from "../server/modules/PerplexityApiClient.js";

/**
 * Handles web search with configurable detail levels
 */
export default async function search(
  args: {
    query: string;
    detail_level?: "brief" | "normal" | "detailed";
    stream?: boolean;
  },
  apiClient: PerplexityApiClient,
): Promise<string> {
  const { query, detail_level = "normal" } = args;

  let prompt = query;
  switch (detail_level) {
    case "brief":
      prompt = `Provide a brief, concise answer to: ${query}`;
      break;
    case "detailed":
      prompt = `Provide a comprehensive, detailed analysis of: ${query}. Include relevant examples, context, and supporting information where applicable.`;
      break;
    default:
      prompt = `Provide a clear, balanced answer to: ${query}. Include key points and relevant context.`;
  }

  return await apiClient.chatCompletion([{ role: "user", content: prompt }]);
}
