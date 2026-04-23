/**
 * Tool implementation for chat functionality with Perplexity
 */

import crypto from "node:crypto";
import type { PerplexityApiClient } from "../server/modules/PerplexityApiClient.js";
import type { ChatMessage } from "../types/index.js";

/**
 * Handles chat interactions with conversation history
 */
export default async function chatPerplexity(
  args: { message: string; chat_id?: string },
  apiClient: PerplexityApiClient,
  getChatHistory: (chat_id: string) => ChatMessage[],
  saveChatMessage: (chat_id: string, message: ChatMessage) => void,
): Promise<string> {
  const { message, chat_id = crypto.randomUUID() } = args;
  const history = getChatHistory(chat_id);
  const userMessage: ChatMessage = { role: "user", content: message };
  saveChatMessage(chat_id, userMessage);

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];

  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content });
  }
  messages.push({ role: "user", content: message });

  return await apiClient.chatCompletion(messages);
}
