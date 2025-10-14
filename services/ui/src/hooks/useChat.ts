import { useCallback, useEffect, useRef, useState } from "react";

import { API_BASE_URL } from "../config/client";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

type SendMessageOptions = {
  model?: string;
};

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestMessagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    latestMessagesRef.current = messages;
  }, [messages]);

  const postChat = useCallback(async (contextMessages: ChatMessage[], options?: SendMessageOptions) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: contextMessages,
          ...(options?.model ? { model: options.model } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();

      const reply =
        data?.message ??
        data?.reply ??
        data?.content ??
        data?.messages?.[data.messages.length - 1]?.content ??
        (typeof data === "string" ? data : JSON.stringify(data));

      if (!reply) {
        throw new Error("Empty response from proxy");
      }

      setMessages((prev) => [...prev, { role: "assistant", content: String(reply) }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string, options?: SendMessageOptions) => {
      const trimmed = content.trim();
      if (!trimmed) {
        return;
      }

      const userMessage: ChatMessage = { role: "user", content: trimmed };
      const updatedMessages = [...latestMessagesRef.current, userMessage];
      setMessages(updatedMessages);
      await postChat(updatedMessages, options);
    },
    [postChat],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    loading,
    error,
    sendMessage,
    reset,
  };
}
