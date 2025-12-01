import type { ChatApiResponse } from "../api/chat";
import type { SearchResultsResponse, AssistantRichContent } from "../types";
import {
  RESPONSE_ASK_USER,
  RESPONSE_ANSWER,
  RESPONSE_NO_RESULTS,
  RESPONSE_NOT_RELEVANT,
  RESPONSE_ERROR,
  SEARCH_RESULTS,
} from "../constants";

export type ParsedResponse = {
  content: string | null;
  richContent: AssistantRichContent | null;
  conversationId: string | null;
  shouldContinueConversation: boolean;
  error?: string;
};

/**
 * Parse the API response and extract relevant data for the UI.
 */
export function parseApiResponse(data: ChatApiResponse): ParsedResponse {
  const responseType = data?.type ?? RESPONSE_ANSWER;
  const conversationId = data?.conversationId ?? null;
  const hasConversationId = Boolean(conversationId);
  
  let content: string | null = null;
  let richContent: AssistantRichContent | null = null;
  let shouldContinueConversation = hasConversationId;
  let error: string | undefined;

  switch (responseType) {
  case RESPONSE_ASK_USER:
      // Backend is asking a follow-up question
      content = data?.prompt ?? "Kun je wat meer details delen?";
      shouldContinueConversation = true;
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
      content = data?.reason ?? "Pixie backend gaf een foutmelding.";
      error = data?.reason ?? "Pixie backend gaf een foutmelding.";
      shouldContinueConversation = false;
      break;

    default:
      // Fallback for unknown response types
      content = data?.text ?? data?.prompt ?? data?.reason ?? null;
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
    conversationId: shouldContinueConversation ? conversationId : null,
    shouldContinueConversation,
    error,
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
