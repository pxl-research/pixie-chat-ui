import type { ChatApiResponse } from "../api/chat";
import type { SearchResultsResponse, AssistantRichContent } from "../types";
import {
  RESPONSE_ASK_USER,
  RESPONSE_ANSWER,
  RESPONSE_SUMMARY,
  RESPONSE_NO_RESULTS,
  RESPONSE_NOT_RELEVANT,
  RESPONSE_ERROR,
  SEARCH_RESULTS,
} from "../constants";
import type { MessageVariant } from "../types";

export type ParsedResponse = {
  content: string | null;
  richContent: AssistantRichContent | null;
  conversationId: string | null;
  state: Record<string, unknown> | null;
  shouldContinueConversation: boolean;
  messageVariant?: MessageVariant;
  error?: string;
  isComplete: boolean;
};

/**
 * Parse the API response and extract relevant data for the UI.
 */
export function parseApiResponse(data: ChatApiResponse): ParsedResponse {
  const responseType = data?.type ?? RESPONSE_ANSWER;
  const conversationId = data?.conversation_id ?? data?.conversationId ?? null;
  const hasConversationId = Boolean(conversationId);
  const state =
    data?.state && typeof data.state === "object" && !Array.isArray(data.state)
      ? data.state
      : null;
  
  let content: string | null = null;
  let richContent: AssistantRichContent | null = null;
  let shouldContinueConversation = hasConversationId;
  let messageVariant: MessageVariant | undefined;
  let error: string | undefined;
  let isComplete = false;

  switch (responseType) {
    case RESPONSE_ASK_USER:
      // Backend is asking a follow-up question
      content = data?.text ?? "Kun je wat meer details delen?";
      shouldContinueConversation = true;
      break;

    case RESPONSE_SUMMARY:
      content = data?.text ?? "Geen antwoord beschikbaar.";
      messageVariant = "summary";
      shouldContinueConversation = false;
      isComplete = true;
      break;

    case RESPONSE_ANSWER:
    case RESPONSE_NO_RESULTS:
    case RESPONSE_NOT_RELEVANT:
      // Try to parse search results from answer text
      if (responseType === RESPONSE_ANSWER && typeof data?.text === "string") {
        const parsed = tryParseSearchResults(data.text);
        if (parsed) {
          richContent = { type: SEARCH_RESULTS, results: parsed };
          content = null;
        } else {
          content = data.text;
        }
      } else {
        content = data?.text ?? "Geen antwoord beschikbaar.";
      }
      break;

    case RESPONSE_ERROR:
      content = data?.text ?? "Pixie backend gaf een foutmelding.";
      error = data?.text ?? "Pixie backend gaf een foutmelding.";
      shouldContinueConversation = false;
      isComplete = true;
      break;

    default:
      // Fallback for unknown response types
      content = data?.text ?? null;
      shouldContinueConversation = !!conversationId;
      break;
  }

  // Prevent empty assistant responses in the UI
  if (!content && !richContent) {
    content = "Geen antwoord beschikbaar.";
  }

  return {
    content,
    richContent,
    conversationId,
    state,
    shouldContinueConversation,
    messageVariant,
    error,
    isComplete,
  };
}

/**
 * Attempt to parse a JSON string as search results.
 * Returns null if parsing fails or if the result doesn't look like search results.
 */
function tryParseSearchResults(text: string): SearchResultsResponse | null {
  try {
    const parsed = JSON.parse(text) as SearchResultsResponse | null;
    
    // Validate it looks like search results
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.items) && parsed.items.length > 0) {
      return parsed;
    }
  } catch {
    // Not valid JSON or not search results
  }
  
  return null;
}
