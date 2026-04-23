/**
 * Tool implementation for chat functionality with Perplexity API
 */

import crypto from "node:crypto";
import type { ChatMessage } from "../types/index.js";
import type { PerplexityApiClient } from "../server/modules/PerplexityApiClient.js";

/**
 * Handles chat interactions with conversation history via Perplexity API
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

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    {
      role: "system",
      content:
        "You are a helpful conversational assistant with access to the web via Perplexity. Maintain context from the conversation history and provide accurate, well-sourced answers.",
    },
  ];

  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content });
  }
  messages.push({ role: "user", content: message });

  const response = await apiClient.chatCompletion(messages);

  saveChatMessage(chat_id, { role: "assistant", content: response });
  return response;
}
