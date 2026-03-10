import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ROLE_ASSISTANT, ROLE_USER } from "@pixie-chat/constants";
import {
  parsePixieChatResponse,
  type QuickReplyOption,
} from "@pixie-chat/responseParser";

import { readKioskConfig, type KioskConfig } from "../config";
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
  const [quickReplies, setQuickReplies] = useState<QuickReplyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversationState, setConversationState] = useState<Record<string, unknown>>({});
  const idleTimeoutRef = useRef<number | null>(null);

  const clearIdleTimeout = useCallback(() => {
    if (idleTimeoutRef.current !== null) {
      window.clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  }, []);

  const resetConversation = useCallback(() => {
    clearIdleTimeout();
    setPhase("start");
    setMessages([]);
    setQuickReplies([]);
    setLoading(false);
    setError(null);
    setSessionId(null);
    setConversationState({});
  }, [clearIdleTimeout]);

  const armIdleTimeout = useCallback(() => {
    clearIdleTimeout();
    const resolvedConfig = config ?? readKioskConfig();
    idleTimeoutRef.current = window.setTimeout(() => {
      resetConversation();
    }, resolvedConfig.idleTimeoutMs);
  }, [clearIdleTimeout, config, resetConversation]);

  useEffect(() => clearIdleTimeout, [clearIdleTimeout]);

  const startConversation = useCallback(() => {
    setMessages([]);
    setQuickReplies([]);
    setError(null);
    setLoading(false);
    setConversationState({});
    setSessionId(createSessionId());
    setPhase("chatting");
    armIdleTimeout();
  }, [armIdleTimeout]);

  const sendUserMessage = useCallback(
    async (content: string) => {
      const trimmedContent = content.trim();
      if (!trimmedContent) {
        return;
      }

      const resolvedConfig = config ?? readKioskConfig();
      const activeSessionId = sessionId ?? createSessionId();

      setPhase("chatting");
      setLoading(true);
      setError(null);
      setQuickReplies([]);
      setSessionId(activeSessionId);
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

        const assistantMessages: KioskMessage[] = [];
        if (parsed.content) {
          assistantMessages.push({
            role: ROLE_ASSISTANT,
            content: parsed.content,
          });
        }
        if (parsed.summaryContent) {
          assistantMessages.push({
            role: ROLE_ASSISTANT,
            content: parsed.summaryContent,
            variant: "summary",
          });
        }
        if (parsed.followUpQuestionContent) {
          assistantMessages.push({
            role: ROLE_ASSISTANT,
            content: parsed.followUpQuestionContent,
          });
        }
        if (assistantMessages.length > 0) {
          setMessages((previous) => [...previous, ...assistantMessages]);
        }

        if (parsed.isComplete) {
          setPhase("completed");
          setQuickReplies([]);
        } else {
          setPhase("chatting");
          armIdleTimeout();
        }
      } catch (caughtError) {
        clearIdleTimeout();
        setPhase("error");
        setQuickReplies([]);
        setError(
          caughtError instanceof Error ? caughtError.message : "De kioskservice is tijdelijk onbereikbaar.",
        );
      } finally {
        setLoading(false);
      }
    },
    [armIdleTimeout, clearIdleTimeout, config, conversationState, sendMessage, sessionId],
  );

  return {
    phase,
    messages,
    quickReplies,
    loading,
    error,
    sessionId,
    startConversation,
    sendUserMessage,
    resetConversation,
  };
}
