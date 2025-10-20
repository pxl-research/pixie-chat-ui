import { useCallback, useEffect, useState } from "react";

import { sendChatMessage } from "../api/chat";
import { parseApiResponse } from "../utils/responseParser";
import { ROLE_USER, ROLE_ASSISTANT } from "../constants";
import type { AssistantRichContent, ChatMessage as ChatMessageType, SearchResultAttribute, SearchResultItem, SearchResultsResponse } from "../types";

export type ChatMessage = ChatMessageType & { rich?: AssistantRichContent | null };

// Re-export types for backward compatibility from centralized types
export type { SearchResultAttribute, SearchResultItem, SearchResultsResponse, AssistantRichContent };

/**
 * Hook for managing chat state and interactions.
 */
export function useChat(initialAssistantMessage?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialAssistantMessage ? [{ role: ROLE_ASSISTANT, content: initialAssistantMessage, rich: null }] : [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Reset when initial message changes
  useEffect(() => {
    if (initialAssistantMessage === undefined) {
      return;
    }
  setMessages(initialAssistantMessage ? [{ role: ROLE_ASSISTANT, content: initialAssistantMessage, rich: null }] : []);
    setError(null);
    setConversationId(null);
  }, [initialAssistantMessage]);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) {
        return;
      }

      // Add user message to chat
  setMessages((prev) => [...prev, { role: ROLE_USER, content: trimmed }]);
      setLoading(true);
      setError(null);

      try {
        // Call API
        const apiResponse = await sendChatMessage({
          input: trimmed,
          conversationId,
        });

        // Parse response
        const parsed = parseApiResponse(apiResponse);

        // Update conversation state
        setConversationId(parsed.conversationId);

        // Update error state if needed
        if (parsed.error) {
          setError(parsed.error);
        }

        // Add assistant message to chat
        setMessages((prev) => [
          ...prev,
          { role: ROLE_ASSISTANT, content: parsed.content ?? "", rich: parsed.richContent },
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Onbekende fout";
        setError(message);
        setConversationId(null);
      } finally {
        setLoading(false);
      }
    },
    [conversationId],
  );

  const reset = useCallback((welcomeMessage?: string) => {
  setMessages(welcomeMessage ? [{ role: ROLE_ASSISTANT, content: welcomeMessage, rich: null }] : []);
    setError(null);
    setConversationId(null);
  }, []);

  return {
    messages,
    loading,
    error,
    sendMessage,
    reset,
  };
}
