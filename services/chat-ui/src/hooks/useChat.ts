import { useCallback, useEffect, useState } from "react";

import { sendChatMessage } from "../api/chat";
import { parseApiResponse } from "../utils/responseParser";
import { ROLE_USER, ROLE_ASSISTANT } from "../constants";
import type { AssistantRichContent, ChatMessage as ChatMessageType, SearchResultAttribute, SearchResultItem, SearchResultsResponse } from "../types";

export type ChatMessage = ChatMessageType & { rich?: AssistantRichContent | null };

// Re-export types for backward compatibility from centralized types
export type { SearchResultAttribute, SearchResultItem, SearchResultsResponse, AssistantRichContent };

const createSessionId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

/**
 * Hook for managing chat state and interactions.
 */
export function useChat(initialAssistantMessage?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialAssistantMessage ? [{ role: ROLE_ASSISTANT, content: initialAssistantMessage, rich: null }] : [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversationState, setConversationState] = useState<Record<string, unknown>>({});
  const [isComplete, setIsComplete] = useState(false);


  // Reset when initial message changes
  useEffect(() => {
    if (initialAssistantMessage === undefined) {
      return;
    }
    setMessages(initialAssistantMessage ? [{ role: ROLE_ASSISTANT, content: initialAssistantMessage, rich: null }] : []);
    setError(null);
    setSessionId(null);
    setConversationState({});
    setIsComplete(false);
  }, [initialAssistantMessage]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (isComplete) {
        return;
      }
      const trimmed = content.trim();
      if (!trimmed) {
        return;
      }

      // Add user message to chat
      setMessages((prev) => [...prev, { role: ROLE_USER, content: trimmed }]);
      setLoading(true);
      setError(null);

      try {
        const nextSessionId = sessionId ?? createSessionId();
        // Call API
        const apiResponse = await sendChatMessage({
          currentAnswer: trimmed,
          sessionId: nextSessionId,
          state: conversationState,
        });

        // Parse response
        const parsed = parseApiResponse(apiResponse);

        // Update conversation state
        setSessionId(parsed.conversationId ?? nextSessionId);
        if (parsed.state) {
          setConversationState(parsed.state);
        }
        setIsComplete(parsed.isComplete);

        // Update error state if needed
        if (parsed.error) {
          setError(parsed.error);
        }

        const assistantContent = parsed.content?.trim() ?? "";
        const hasAssistantMessage = assistantContent.length > 0 || parsed.richContent;

        // Add assistant message to chat only if we have something to show
        if (hasAssistantMessage) {
          setMessages((prev) => [
            ...prev,
            {
              role: ROLE_ASSISTANT,
              content: assistantContent,
              rich: parsed.richContent,
            },
          ]);
        }
        const summaryContent = parsed.summaryContent;
        if (summaryContent) {
          setMessages((prev) => [
            ...prev,
            {
              role: ROLE_ASSISTANT,
              content: summaryContent,
              variant: parsed.messageVariant ?? "summary",
            },
          ]);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Onbekende fout";
        setError(message);
        setSessionId(null);
        setConversationState({});
        setIsComplete(false);
      } finally {
        setLoading(false);
      }
    },
    [conversationState, isComplete, sessionId],
  );

  const reset = useCallback((welcomeMessage?: string) => {
    setMessages(welcomeMessage ? [{ role: ROLE_ASSISTANT, content: welcomeMessage, rich: null }] : []);
    setError(null);
    setSessionId(null);
    setConversationState({});
    setIsComplete(false);
  }, []);

  return {
    messages,
    loading,
    error,
    sendMessage,
    reset,
    isComplete,
  };
}
