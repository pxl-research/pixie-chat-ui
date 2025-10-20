import type { ChatApiResponse } from "../api/chat";

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

export type AssistantRichContent = {
  type: "search-results";
  results: SearchResultsResponse;
};

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
  const responseType = data?.type ?? "answer";
  const conversationId = data?.conversationId ?? null;
  
  let content: string | null = null;
  let richContent: AssistantRichContent | null = null;
  let shouldContinueConversation = false;
  let error: string | undefined;

  switch (responseType) {
    case "ask_user":
      // Backend is asking a follow-up question
      content = data?.prompt ?? "Kun je wat meer details delen?";
      shouldContinueConversation = true;
      break;

    case "answer":
    case "no_results":
    case "not_relevant":
      // Try to parse search results from answer text
      if (responseType === "answer" && typeof data?.text === "string") {
        const parsed = tryParseSearchResults(data.text);
        if (parsed) {
          richContent = { type: "search-results", results: parsed };
          content = null;
        } else {
          content = data.text;
        }
      } else {
        content = data?.text ?? "Geen antwoord beschikbaar.";
      }
      break;

    case "error":
      content = data?.reason ?? "Pixie Core gaf een foutmelding.";
      error = data?.reason ?? "Pixie Core gaf een foutmelding.";
      break;

    default:
      // Fallback for unknown response types
      content = data?.text ?? data?.prompt ?? data?.reason ?? null;
      shouldContinueConversation = !!conversationId;
      break;
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
