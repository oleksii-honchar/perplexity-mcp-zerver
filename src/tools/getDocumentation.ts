/**
 * Tool implementation for documentation retrieval via Perplexity API
 */

import type { PerplexityApiClient } from "../server/modules/PerplexityApiClient.js";

/**
 * Handles documentation fetching and formatting via Perplexity API
 */
export default async function getDocumentation(
  args: { query: string; context?: string },
  apiClient: PerplexityApiClient,
): Promise<string> {
  const { query, context = "" } = args;
  const prompt = `Provide comprehensive documentation and usage examples for ${query}. ${
    context ? `Focus on: ${context}` : ""
  } Include:
1. Basic overview and purpose
2. Key features and capabilities
3. Installation/setup if applicable
4. Common usage examples with code snippets
5. Best practices and performance considerations
6. Common pitfalls to avoid
7. Version compatibility information
8. Links to official documentation
9. Community resources (forums, chat channels)
10. Related tools/libraries that work well with it

Crucially, also provide the main official URL(s) for this documentation on separate lines, prefixed with 'Official URL(s):'.`;

  return apiClient.chatCompletion([
    {
      role: "system",
      content:
        "You are a technical documentation assistant. Provide structured, accurate documentation with examples, best practices, and links to official resources when available.",
    },
    { role: "user", content: prompt },
  ]);
}
