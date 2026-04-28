import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ROLE_ASSISTANT, ROLE_USER } from "@pixie-chat/constants";
import {
  parsePixieChatResponse,
  type QuickReplyOption,
  type WineRecommendationItem,
} from "@pixie-chat/responseParser";

import {
  readKioskConfig,
  readKioskTimingConfig,
  type KioskConfig,
} from "../config";
import {
  sendQuestionerMessage,
  type QuestionerChatResponse,
  type SendQuestionerMessageInput,
} from "../api/questioner";

export type KioskPhase = "start" | "chatting" | "completed" | "error";

export type KioskMessage = {
  role: typeof ROLE_USER | typeof ROLE_ASSISTANT;
  content: string;
  variant?: "summary";
};

export type KioskRecommendations = {
  intro: string;
  items: WineRecommendationItem[];
};

type SendQuestionerMessage = (
  input: SendQuestionerMessageInput,
) => Promise<QuestionerChatResponse>;

type UseKioskSessionOptions = {
  config?: KioskConfig;
  sendMessage?: SendQuestionerMessage;
};

function createSessionId() {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject?.randomUUID) {
    return cryptoObject.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useKioskSession(options: UseKioskSessionOptions = {}) {
  const config = useMemo(() => options.config, [options.config]);
  const sendMessage = options.sendMessage ?? sendQuestionerMessage;
  const [phase, setPhase] = useState<KioskPhase>("start");
  const [messages, setMessages] = useState<KioskMessage[]>([]);
  const [recommendations, setRecommendations] =
    useState<KioskRecommendations | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReplyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversationState, setConversationState] = useState<Record<string, unknown>>({});
  const idleTimeoutRef = useRef<number | null>(null);
  const completedTimeoutRef = useRef<number | null>(null);
  const recommendationsRef = useRef<KioskRecommendations | null>(null);

  const clearIdleTimeout = useCallback(() => {
    if (idleTimeoutRef.current !== null) {
      window.clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  }, []);

  const clearCompletedTimeout = useCallback(() => {
    if (completedTimeoutRef.current !== null) {
      window.clearTimeout(completedTimeoutRef.current);
      completedTimeoutRef.current = null;
    }
  }, []);

  const resetConversation = useCallback(() => {
    clearIdleTimeout();
    clearCompletedTimeout();
    setPhase("start");
    setMessages([]);
    setRecommendations(null);
    setFollowUpQuestion(null);
    setQuickReplies([]);
    setLoading(false);
    setError(null);
    setSessionId(null);
    setConversationState({});
  }, [clearCompletedTimeout, clearIdleTimeout]);

  const armIdleTimeout = useCallback(() => {
    clearIdleTimeout();
    const resolvedTiming = config ?? readKioskTimingConfig();
    idleTimeoutRef.current = window.setTimeout(() => {
      resetConversation();
    }, resolvedTiming.idleTimeoutMs);
  }, [clearIdleTimeout, config, resetConversation]);

  const armCompletedTimeout = useCallback(() => {
    clearCompletedTimeout();
    const resolvedTiming = config ?? readKioskTimingConfig();
    completedTimeoutRef.current = window.setTimeout(() => {
      resetConversation();
    }, resolvedTiming.resetDelayMs);
  }, [clearCompletedTimeout, config, resetConversation]);

  useEffect(
    () => () => {
      clearIdleTimeout();
      clearCompletedTimeout();
    },
    [clearCompletedTimeout, clearIdleTimeout],
  );

  useEffect(() => {
    recommendationsRef.current = recommendations;
  }, [recommendations]);

  const startConversation = useCallback(() => {
    clearCompletedTimeout();
    setMessages([]);
    setRecommendations(null);
    setFollowUpQuestion(null);
    setQuickReplies([]);
    setError(null);
    setLoading(false);
    setConversationState({});
    setSessionId(createSessionId());
    setPhase("chatting");
    armIdleTimeout();
  }, [armIdleTimeout, clearCompletedTimeout]);

  const sendUserMessage = useCallback(
    async (content: string) => {
      const trimmedContent = content.trim();
      if (!trimmedContent) {
        return;
      }

      const resolvedConfig = config ?? readKioskConfig();
      const activeSessionId = sessionId ?? createSessionId();
      const hadRecommendations = recommendationsRef.current !== null;

      setPhase("chatting");
      setLoading(true);
      setError(null);
      setQuickReplies([]);
      setSessionId(activeSessionId);
      clearCompletedTimeout();
      setMessages((previous) => [
        ...previous,
        {
          role: ROLE_USER,
          content: trimmedContent,
        },
      ]);

      try {
        const response = await sendMessage({
          baseUrl: resolvedConfig.questionerBaseUrl,
          caseId: resolvedConfig.caseId,
          currentAnswer: trimmedContent,
          sessionId: activeSessionId,
          state: conversationState,
        });
        const parsed = parsePixieChatResponse(response);

        setSessionId(parsed.conversationId ?? activeSessionId);
        setConversationState(parsed.state ?? {});
        setQuickReplies(parsed.quickReplies);

        const hasWineRecommendations = parsed.richContent?.type === "wine_recommendations";

        if (hasWineRecommendations && parsed.richContent?.type === "wine_recommendations") {
          setRecommendations({
            intro: parsed.richContent.intro,
            items: parsed.richContent.items,
          });
          setFollowUpQuestion(parsed.followUpQuestionContent ?? null);
        } else if (hadRecommendations) {
          // Stay in feedback mode: keep recommendations visible, update follow-up question
          if (parsed.isComplete) {
            setFollowUpQuestion(null);
          } else {
            setFollowUpQuestion(parsed.content);
          }
        } else {
          setRecommendations(null);
          setFollowUpQuestion(null);
        }

        const assistantMessages: KioskMessage[] = [];
        if (!hasWineRecommendations && !hadRecommendations) {
          if (parsed.content) {
            assistantMessages.push({
              role: ROLE_ASSISTANT,
              content: parsed.content,
            });
          }
          if (parsed.followUpQuestionContent) {
            assistantMessages.push({
              role: ROLE_ASSISTANT,
              content: parsed.followUpQuestionContent,
            });
          }
        }
        if (parsed.summaryContent) {
          assistantMessages.push({
            role: ROLE_ASSISTANT,
            content: parsed.summaryContent,
            variant: "summary",
          });
        }
        if (assistantMessages.length > 0) {
          setMessages((previous) => [...previous, ...assistantMessages]);
        }

        if (parsed.isComplete) {
          clearIdleTimeout();
          setPhase("completed");
          setQuickReplies([]);
          armCompletedTimeout();
        } else {
          setPhase("chatting");
          armIdleTimeout();
        }
      } catch (caughtError) {
        clearIdleTimeout();
        clearCompletedTimeout();
        setPhase("error");
        setRecommendations(null);
        setFollowUpQuestion(null);
        setQuickReplies([]);
        setError(
          caughtError instanceof Error ? caughtError.message : "De kioskservice is tijdelijk onbereikbaar.",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      armCompletedTimeout,
      armIdleTimeout,
      clearCompletedTimeout,
      clearIdleTimeout,
      config,
      conversationState,
      sendMessage,
      sessionId,
    ],
  );

  return {
    phase,
    messages,
    recommendations,
    followUpQuestion,
    quickReplies,
    loading,
    error,
    sessionId,
    startConversation,
    sendUserMessage,
    resetConversation,
  };
}
