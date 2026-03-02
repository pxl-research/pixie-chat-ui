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

type UseChatOptions = {
  debugModeEnabled?: boolean;
  showDebugMessages?: boolean;
};

function sanitizeConversationState(
  value?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...value };
}

function sanitizeStateForRequest(
  value: Record<string, unknown>,
  debugModeEnabled: boolean,
): Record<string, unknown> {
  const sanitized = { ...value };
  if (debugModeEnabled) {
    sanitized.debug_mode = true;
    return sanitized;
  }
  delete sanitized.debug_mode;
  delete sanitized.debug;
  return sanitized;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function buildDebugMessage(state: Record<string, unknown> | null): string | null {
  if (!state) {
    return null;
  }
  const debug = state.debug;
  if (!debug || typeof debug !== "object" || Array.isArray(debug)) {
    return null;
  }
  const debugRecord = debug as Record<string, unknown>;
  if (debugRecord.enabled !== true) {
    return null;
  }
  const rawTrace = debugRecord.trace;
  if (!Array.isArray(rawTrace) || rawTrace.length === 0) {
    return null;
  }
  const lastEvent = rawTrace[rawTrace.length - 1];
  if (!lastEvent || typeof lastEvent !== "object" || Array.isArray(lastEvent)) {
    return null;
  }

  const event = lastEvent as Record<string, unknown>;
  const turn = typeof event.turn === "number" ? event.turn : null;
  const action = typeof event.action === "string" ? event.action : "";
  const mealMode = typeof event.meal_mode === "string" ? event.meal_mode : "";
  const controllerExplanation =
    typeof event.controller_explanation === "string" ? event.controller_explanation : "";
  const questionText = typeof event.question_text === "string" ? event.question_text : "";
  const rankerExplanation =
    typeof event.ranker_explanation === "string" ? event.ranker_explanation : "";
  const selectedBarcodes = toStringArray(event.selected_barcodes);

  const lines: string[] = [];
  const headerParts: string[] = [];
  if (turn !== null) {
    headerParts.push(`turn ${turn}`);
  }
  if (action) {
    headerParts.push(`actie ${action}`);
  }
  if (mealMode) {
    headerParts.push(`mode ${mealMode}`);
  }
  lines.push(`**Debug**${headerParts.length > 0 ? ` (${headerParts.join(", ")})` : ""}`);
  if (controllerExplanation) {
    lines.push(`Controller: ${controllerExplanation}`);
  }
  if (questionText) {
    lines.push(`Vraag: ${questionText}`);
  }
  if (selectedBarcodes.length > 0) {
    lines.push(`Selectie: ${selectedBarcodes.join(", ")}`);
  }
  if (rankerExplanation) {
    lines.push(`Ranker: ${rankerExplanation}`);
  }
  return lines.length > 1 ? lines.join("\n") : null;
}

/**
 * Hook for managing chat state and interactions.
 */
export function useChat(
  initialAssistantMessage?: string,
  stickyConversationState?: Record<string, unknown>,
  options?: UseChatOptions,
) {
  const debugModeEnabled = options?.debugModeEnabled === true;
  const showDebugMessages = options?.showDebugMessages !== false;
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
    useState<Record<string, unknown>>(
      sanitizeStateForRequest(sanitizedStickyState, debugModeEnabled),
    );
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

  useEffect(() => {
    setConversationState((previous) =>
      sanitizeStateForRequest(
        {
          ...previous,
          ...sanitizedStickyState,
        },
        debugModeEnabled,
      ),
    );
  }, [debugModeEnabled, sanitizedStickyState]);

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
        const requestState = sanitizeStateForRequest(
          {
            ...conversationState,
            ...sanitizedStickyState,
          },
          debugModeEnabled,
        );
        // Call API
        const apiResponse = await sendChatMessage({
          currentAnswer: trimmed,
          sessionId: nextSessionId,
          state: requestState,
        });

        // Parse response
        const parsed = parseApiResponse(apiResponse);

        // Update conversation state
        setSessionId(parsed.conversationId ?? nextSessionId);
        if (parsed.state) {
          setConversationState(sanitizeStateForRequest({
            ...parsed.state,
            ...sanitizedStickyState,
          }, debugModeEnabled));
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

        if (debugModeEnabled && showDebugMessages) {
          const debugMessage = buildDebugMessage(parsed.state);
          if (debugMessage) {
            assistantMessages.push({
              role: ROLE_ASSISTANT,
              content: debugMessage,
              variant: "debug",
            });
          }
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
              if (message.variant === "debug") {
                const lastMessage = nextMessages[nextMessages.length - 1];
                if (
                  lastMessage &&
                  lastMessage.role === ROLE_ASSISTANT &&
                  lastMessage.variant === "debug" &&
                  lastMessage.content.trim() === message.content.trim()
                ) {
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
        setConversationState(
          sanitizeStateForRequest(sanitizedStickyState, debugModeEnabled),
        );
        setIsComplete(false);
        setActiveQuickReplies([]);
      } finally {
        setLoading(false);
      }
    },
    [
      conversationState,
      debugModeEnabled,
      isComplete,
      sanitizedStickyState,
      sessionId,
      showDebugMessages,
    ],
  );

  const reset = useCallback((welcomeMessage?: string) => {
    setMessages(welcomeMessage ? [{ role: ROLE_ASSISTANT, content: welcomeMessage, rich: null }] : []);
    setError(null);
    setSessionId(null);
    setConversationState(sanitizeStateForRequest(sanitizedStickyState, debugModeEnabled));
    setIsComplete(false);
    setActiveQuickReplies([]);
  }, [debugModeEnabled, sanitizedStickyState]);

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
