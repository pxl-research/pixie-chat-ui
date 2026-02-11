import { useCallback, useEffect, useMemo, useState } from "react";

import { sendChatMessage } from "../api/chat";
import { parseApiResponse } from "../utils/responseParser";
import { ROLE_USER, ROLE_ASSISTANT } from "../constants";
import type {
  AssistantRichContent,
  ChatMessage as ChatMessageType,
  QuickReplyOption,
  SearchResultAttribute,
  SearchResultItem,
  SearchResultsResponse,
} from "../types";

export type ChatMessage = ChatMessageType & { rich?: AssistantRichContent | null };

// Re-export types for backward compatibility from centralized types
export type { SearchResultAttribute, SearchResultItem, SearchResultsResponse, AssistantRichContent };

const createSessionId = () => {
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback for very old environments without `crypto`.
  // This should not be relied on for security-sensitive contexts.
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

function sanitizeConversationState(
  value?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...value };
}

/**
 * Hook for managing chat state and interactions.
 */
export function useChat(
  initialAssistantMessage?: string,
  stickyConversationState?: Record<string, unknown>,
) {
  const sanitizedStickyState = useMemo(
    () => sanitizeConversationState(stickyConversationState),
    [stickyConversationState],
  );
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialAssistantMessage ? [{ role: ROLE_ASSISTANT, content: initialAssistantMessage, rich: null }] : [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversationState, setConversationState] =
    useState<Record<string, unknown>>(sanitizedStickyState);
  const [isComplete, setIsComplete] = useState(false);
  const [activeQuickReplies, setActiveQuickReplies] = useState<QuickReplyOption[]>([]);

  // Reset when initial message changes
  useEffect(() => {
    if (initialAssistantMessage === undefined) {
      return;
    }
    setMessages(initialAssistantMessage ? [{ role: ROLE_ASSISTANT, content: initialAssistantMessage, rich: null }] : []);
    setError(null);
    setSessionId(null);
    setConversationState(sanitizedStickyState);
    setIsComplete(false);
    setActiveQuickReplies([]);
  }, [initialAssistantMessage, sanitizedStickyState]);

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
      setActiveQuickReplies([]);

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
          setConversationState({
            ...parsed.state,
            ...sanitizedStickyState,
          });
        }
        setIsComplete(parsed.isComplete);
        setActiveQuickReplies(parsed.isComplete ? [] : parsed.quickReplies);

        // Update error state if needed
        if (parsed.error) {
          setError(parsed.error);
        }

        const assistantContent = parsed.content?.trim() ?? "";
        const hasAssistantMessage = assistantContent.length > 0 || parsed.richContent;
        const summaryContent = parsed.summaryContent;
        const followUpQuestionContent = parsed.followUpQuestionContent;

        const assistantMessages: ChatMessage[] = [];

        // Add assistant message to chat only if we have something to show
        if (hasAssistantMessage) {
          assistantMessages.push({
            role: ROLE_ASSISTANT,
            content: assistantContent,
            rich: parsed.richContent,
          });
        }

        if (summaryContent) {
          assistantMessages.push({
            role: ROLE_ASSISTANT,
            content: summaryContent,
            variant: parsed.messageVariant ?? "summary",
          });
        }

        if (followUpQuestionContent) {
          assistantMessages.push({
            role: ROLE_ASSISTANT,
            content: followUpQuestionContent,
          });
        }

        if (assistantMessages.length > 0) {
          setMessages((prev) => {
            const nextMessages = [...prev];
            for (const message of assistantMessages) {
              if (message.variant === "summary") {
                const alreadyShown = nextMessages.some(
                  (existing) =>
                    existing.role === ROLE_ASSISTANT &&
                    existing.variant === "summary" &&
                    existing.content.trim() === message.content.trim(),
                );
                if (alreadyShown) {
                  continue;
                }
              }
              nextMessages.push(message);
            }
            return nextMessages;
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Onbekende fout";
        setError(message);
        setSessionId(null);
        setConversationState(sanitizedStickyState);
        setIsComplete(false);
        setActiveQuickReplies([]);
      } finally {
        setLoading(false);
      }
    },
    [conversationState, isComplete, sanitizedStickyState, sessionId],
  );

  const reset = useCallback((welcomeMessage?: string) => {
    setMessages(welcomeMessage ? [{ role: ROLE_ASSISTANT, content: welcomeMessage, rich: null }] : []);
    setError(null);
    setSessionId(null);
    setConversationState(sanitizedStickyState);
    setIsComplete(false);
    setActiveQuickReplies([]);
  }, [sanitizedStickyState]);

  return {
    messages,
    loading,
    error,
    sendMessage,
    reset,
    isComplete,
    activeQuickReplies,
  };
}
