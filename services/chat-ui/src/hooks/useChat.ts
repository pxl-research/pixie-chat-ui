import { useCallback, useState } from "react";

import { API_BASE_URL } from "../config/client";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

type PixieResponse = {
  type?: string;
  text?: string | null;
  prompt?: string | null;
  reason?: string | null;
  conversationId?: string | null;
};

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) {
        return;
      }

      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setLoading(true);
      setError(null);

      try {
        const payload: Record<string, unknown> = { input: trimmed };
        if (conversationId) {
          payload.conversationId = conversationId;
        }

        const response = await fetch(`${API_BASE_URL}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const detailText = await response.text();
          let detailMessage = detailText;
          try {
            const parsed = JSON.parse(detailText);
            if (typeof parsed === "string") {
              detailMessage = parsed;
            } else if (parsed?.detail) {
              detailMessage = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
            }
          } catch {
            // Leave detailMessage as-is when JSON parsing fails.
          }
          throw new Error(detailMessage || `Request failed with status ${response.status}`);
        }

        const data: PixieResponse = await response.json();

        const responseType = data?.type ?? "answer";
        const nextConversationId = data?.conversationId ?? null;

        let assistantMessage: string | null = null;

        switch (responseType) {
          case "ask_user":
            assistantMessage = data?.prompt ?? "Kun je wat meer details delen?";
            setConversationId(nextConversationId);
            break;
          case "answer":
          case "no_results":
          case "not_relevant":
            assistantMessage = data?.text ?? "Geen antwoord beschikbaar.";
            setConversationId(null);
            break;
          case "error":
            assistantMessage = data?.reason ?? "Pixie Core gaf een foutmelding.";
            setConversationId(null);
            setError(data?.reason ?? "Pixie Core gaf een foutmelding.");
            break;
          default:
            assistantMessage = data?.text ?? data?.prompt ?? data?.reason ?? null;
            setConversationId(nextConversationId);
            break;
        }

        if (assistantMessage) {
          setMessages((prev) => [...prev, { role: "assistant", content: assistantMessage! }]);
        }
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

  const reset = useCallback(() => {
    setMessages([]);
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
