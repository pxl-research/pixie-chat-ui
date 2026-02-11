import { API_BASE_URL } from "../config/client";
import { CHAT_CONTRACT_VERSION, type QuestionerChatContractResponse } from "./contract";

export type ChatApiRequest = {
  currentAnswer: string;
  sessionId?: string | null;
  state: Record<string, unknown>;
};

export type ChatApiQuickReply =
  | string
  | {
      label?: string | null;
      value?: string | null;
      text?: string | null;
    };

export type ChatApiResponse = {
  type?: string;
  text?: string | null;
  summary?: string | null;
  follow_up_question?: string | null;
  followUpQuestion?: string | null;
  quick_replies?: ChatApiQuickReply[] | null;
  quickReplies?: ChatApiQuickReply[] | null;
  choices?: ChatApiQuickReply[] | null;
  options?: ChatApiQuickReply[] | null;
  suggested_answers?: ChatApiQuickReply[] | null;
  conversation_id?: string | null;
  conversationId?: string | null;
  state?: Record<string, unknown> | null;
  contract_version?: string | null;
};

export type ChatContractResponse = QuestionerChatContractResponse;

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

  const contractHeader = response.headers.get("X-Pixie-Chat-Contract");
  if (contractHeader && contractHeader !== CHAT_CONTRACT_VERSION) {
    // Log detailed information for developers while keeping the user-facing error message generic.
    // This avoids exposing internal contract/version details directly in the UI.
    console.error("Chat contract version mismatch", {
      expected: CHAT_CONTRACT_VERSION,
      received: contractHeader,
    });

    throw new Error(
      "The chat service is temporarily unavailable due to a version mismatch. Please refresh the page or try again later.",
    );
  }

  const parsed = await response.json();
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid JSON response format.");
  }

  const normalizedResponse = parsed as ChatApiResponse;
  if (contractHeader) {
    return { ...normalizedResponse, contract_version: contractHeader };
  }
  return normalizedResponse;
}
