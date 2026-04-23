/**
 * API helper utilities for Perplexity API calls
 */

import type { ChatCompletionMessage } from "../server/modules/PerplexityApiClient.js";

/**
 * Builds a system prompt for search-like queries via Perplexity API
 */
export function buildSearchPrompt(query: string): ChatCompletionMessage[] {
  return [
    {
      role: "system",
      content:
        "You are a helpful research assistant with access to the web via Perplexity. Provide accurate, well-sourced answers with citations when available.",
    },
    { role: "user", content: query },
  ];
}

/**
 * Builds a documentation-specific prompt
 */
export function buildDocumentationPrompt(query: string, context?: string): ChatCompletionMessage[] {
  const userContent = context
    ? `Provide comprehensive documentation and usage examples for ${query}. Focus on: ${context}`
    : `Provide comprehensive documentation and usage examples for ${query}.`;

  return [
    {
      role: "system",
      content:
        "You are a technical documentation assistant. Provide structured, accurate documentation with examples, best practices, and links to official resources when available.",
    },
    { role: "user", content: userContent },
  ];
}

/**
 * Builds an API discovery prompt
 */
export function buildApiDiscoveryPrompt(requirement: string, context?: string): ChatCompletionMessage[] {
  const userContent = context
    ? `Find and evaluate APIs for: ${requirement}. Context: ${context}`
    : `Find and evaluate APIs for: ${requirement}`;

  return [
    {
      role: "system",
      content:
        "You are an API discovery assistant. Help find, compare, and evaluate APIs with details on pricing, authentication, SDKs, and code examples.",
    },
    { role: "user", content: userContent },
  ];
}

/**
 * Builds a deprecated code analysis prompt
 */
export function buildDeprecatedCodePrompt(code: string, technology?: string): ChatCompletionMessage[] {
  const userContent = technology
    ? `Analyze this ${technology} code for deprecated features or patterns and suggest replacements:\n\n${code}`
    : `Analyze this code for deprecated features or patterns and suggest replacements:\n\n${code}`;

  return [
    {
      role: "system",
      content:
        "You are a code modernization assistant. Identify deprecated patterns, suggest replacements, and provide migration guidance with before/after examples.",
    },
    { role: "user", content: userContent },
  ];
}
