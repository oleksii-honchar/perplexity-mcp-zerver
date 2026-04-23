/**
 * Tool implementation for finding APIs via Perplexity API
 */

import type { PerplexityApiClient } from "../server/modules/PerplexityApiClient.js";

/**
 * Handles API discovery and comparison via Perplexity API
 */
export default async function findApis(
  args: { requirement: string; context?: string },
  apiClient: PerplexityApiClient,
): Promise<string> {
  const { requirement, context = "" } = args;
  const prompt = `Find and evaluate APIs that could be used for: ${requirement}. ${
    context ? `Context: ${context}` : ""
  } For each API, provide:
1. Name and brief description
2. Key features and capabilities
3. Pricing model and rate limits
4. Authentication methods
5. Integration complexity
6. Documentation quality and examples
7. Community support and popularity
8. Any potential limitations or concerns
9. Code examples for basic usage
10. Comparison with similar APIs
11. SDK availability and language support`;

  return apiClient.chatCompletion([
    {
      role: "system",
      content:
        "You are an API discovery assistant. Help find, compare, and evaluate APIs with details on pricing, authentication, SDKs, and code examples.",
    },
    { role: "user", content: prompt },
  ]);
}
