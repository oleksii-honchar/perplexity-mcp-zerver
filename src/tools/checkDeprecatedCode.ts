/**
 * Tool handler for 'check_deprecated_code'.
 * Analyzes code for deprecated features or patterns and suggests replacements using Perplexity API.
 * @param args - { code: string; technology?: string }
 * @param apiClient - PerplexityApiClient instance
 * @returns The deprecation analysis string result
 */
import type { PerplexityApiClient } from "../server/modules/PerplexityApiClient.js";

export default async function checkDeprecatedCode(
  args: { code: string; technology?: string },
  apiClient: PerplexityApiClient,
): Promise<string> {
  const { code, technology = "" } = args;
  const prompt = `Analyze this code for deprecated features or patterns${
    technology ? ` in ${technology}` : ""
  }:

${code}

Please provide:
1. Identification of deprecated features/methods
2. Current recommended alternatives
3. Step-by-step migration guide
4. Impact assessment of the changes
5. Deprecation timeline if available
6. Code examples before/after updating
7. Performance implications
8. Backward compatibility considerations
9. Testing recommendations for the changes`;

  return apiClient.chatCompletion([
    {
      role: "system",
      content:
        "You are a code modernization assistant. Identify deprecated patterns, suggest replacements, and provide migration guidance with before/after examples.",
    },
    { role: "user", content: prompt },
  ]);
}
