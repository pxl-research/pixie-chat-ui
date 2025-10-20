import { API_BASE_URL } from "../config/client";

export type ChatApiRequest = {
  input: string;
  conversationId?: string | null;
};

export type ChatApiResponse = {
  type?: string;
  text?: string | null;
  prompt?: string | null;
  reason?: string | null;
  conversationId?: string | null;
};

/**
 * Send a chat message to the backend API.
 * @throws Error if the request fails or returns a non-OK status
 */
export async function sendChatMessage(request: ChatApiRequest): Promise<ChatApiResponse> {
  const payload: Record<string, unknown> = { input: request.input };
  
  if (request.conversationId) {
    payload.conversationId = request.conversationId;
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
      // Keep detailMessage as-is when JSON parsing fails
    }
    
    throw new Error(detailMessage || `Request failed with status ${response.status}`);
  }

  return response.json();
}
