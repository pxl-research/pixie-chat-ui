import { useCallback, useEffect, useState } from "react";

import { API_BASE_URL } from "../config/client";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  rich?: AssistantRichContent | null;
};

type PixieResponse = {
  type?: string;
  text?: string | null;
  prompt?: string | null;
  reason?: string | null;
  conversationId?: string | null;
};

export type SearchResultAttribute = {
  name: string;
  label?: string;
  value: unknown;
};

export type SearchResultItem = {
  brand?: string;
  price?: number;
  availability?: boolean;
  attributes?: SearchResultAttribute[];
};

export type SearchResultsResponse = {
  total?: number;
  count?: number;
  items?: SearchResultItem[];
  [key: string]: unknown;
};

export type AssistantRichContent =
  | {
      type: "search-results";
      results: SearchResultsResponse;
    };

export function useChat(initialAssistantMessage?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialAssistantMessage ? [{ role: "assistant", content: initialAssistantMessage, rich: null }] : [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (initialAssistantMessage === undefined) {
      return;
    }
    setMessages(initialAssistantMessage ? [{ role: "assistant", content: initialAssistantMessage, rich: null }] : []);
    setError(null);
    setConversationId(null);
  }, [initialAssistantMessage]);

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
        let richContent: AssistantRichContent | null = null;

        switch (responseType) {
          case "ask_user":
            assistantMessage = data?.prompt ?? "Kun je wat meer details delen?";
            setConversationId(nextConversationId);
            break;
          case "answer":
          case "no_results":
          case "not_relevant":
            if (responseType === "answer" && typeof data?.text === "string") {
              try {
                const parsed = JSON.parse(data.text) as SearchResultsResponse | null;
                if (parsed && typeof parsed === "object" && Array.isArray(parsed.items) && parsed.items.length > 0) {
                  richContent = {
                    type: "search-results",
                    results: parsed,
                  };
                  assistantMessage = null;
                } else {
                  assistantMessage = data.text;
                }
              } catch {
                assistantMessage = data.text ?? "Geen antwoord beschikbaar.";
              }
            } else {
              assistantMessage = data?.text ?? "Geen antwoord beschikbaar.";
            }
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

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: assistantMessage ?? "", rich: richContent },
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
    setMessages(welcomeMessage ? [{ role: "assistant", content: welcomeMessage, rich: null }] : []);
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
