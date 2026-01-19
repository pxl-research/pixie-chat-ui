import { API_BASE_URL } from "../config/client";

export type ChatApiRequest = {
  currentAnswer: string;
  sessionId?: string | null;
  state: Record<string, unknown>;
};

export type ChatApiResponse = {
  type?: string;
  text?: string | null;
  conversation_id?: string | null;
  conversationId?: string | null;
  state?: Record<string, unknown> | null;
};

/**
 * Send a chat message to the backend API.
 * @throws Error if the request fails or returns a non-OK status
 */
export async function sendChatMessage(request: ChatApiRequest): Promise<ChatApiResponse> {
  const payload: Record<string, unknown> = {
    current_answer: request.currentAnswer,
    session_id: request.sessionId,
    state: request.state,
  };

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
      // Keep detailMessage as-is when JSON parsing fails
    }
    
    throw new Error(detailMessage || `Request failed with status ${response.status}`);
  }

  return response.json();
}
