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
  summaryContent: string | null;
  followUpQuestionContent: string | null;
  shouldContinueConversation: boolean;
  messageVariant?: MessageVariant;
  error?: string;
  isComplete: boolean;
};

const DEFAULT_NO_ANSWER = "Geen antwoord beschikbaar.";

function trimToNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isFeedbackComplete(state: Record<string, unknown> | null): boolean {
  const phase = state?.phase;
  if (phase === "completed") {
    return true;
  }
  const feedbackStatus = state?.feedback_status;
  if (feedbackStatus === "yes" || feedbackStatus === "no") {
    return true;
  }
  const feedbackRequested = state?.feedback_requested;
  return feedbackRequested === "false" || feedbackRequested === false;
}

function extractFirstString(
  source: Record<string, unknown> | null,
  keys: readonly string[],
): string | null {
  if (!source) {
    return null;
  }
  for (const key of keys) {
    const value = trimToNonEmptyString(source[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

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
  const dataObject =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  const textContent = extractFirstString(dataObject, ["text", "answer", "prompt", "reason"]);
  const summaryContent =
    extractFirstString(dataObject, ["summary", "summary_text", "summaryText"]) ??
    extractFirstString(state, ["summary", "summary_text", "summaryText"]);
  const followUpQuestionContent =
    extractFirstString(dataObject, [
      "follow_up_question",
      "followUpQuestion",
      "next_question",
      "nextQuestion",
      "prompt",
      "question",
    ]) ??
    extractFirstString(state, [
      "follow_up_question",
      "followUpQuestion",
      "next_question",
      "nextQuestion",
      "prompt",
      "question",
    ]);
  
  let content: string | null = null;
  let richContent: AssistantRichContent | null = null;
  let shouldContinueConversation = hasConversationId;
  const messageVariant: MessageVariant | undefined = summaryContent ? "summary" : undefined;
  let error: string | undefined;
  let isComplete = false;

  switch (responseType) {
    case RESPONSE_ASK_USER:
      // Backend is asking a follow-up question
      content = textContent ?? "Kun je wat meer details delen?";
      shouldContinueConversation = true;
      break;

    case RESPONSE_SUMMARY:
      content = textContent ?? DEFAULT_NO_ANSWER;
      isComplete = isFeedbackComplete(state);
      shouldContinueConversation = !isComplete && hasConversationId;
      break;

    case RESPONSE_ANSWER:
    case RESPONSE_NO_RESULTS:
    case RESPONSE_NOT_RELEVANT:
      // Try to parse search results from answer text
      if (responseType === RESPONSE_ANSWER && typeof data?.text === "string") {
        const parsed = tryParseSearchResults(data.text);
        if (parsed) {
          richContent = { type: SEARCH_RESULTS, results: parsed };
        }
      }
      content = textContent ?? DEFAULT_NO_ANSWER;
      break;

    case RESPONSE_ERROR:
      content = textContent ?? "Pixie backend gaf een foutmelding.";
      error = textContent ?? "Pixie backend gaf een foutmelding.";
      shouldContinueConversation = false;
      break;

    default:
      // Fallback for unknown response types
      content = textContent ?? null;
      shouldContinueConversation = !!conversationId;
      break;
  }

  // Prevent empty assistant responses in the UI
  if (!content) {
    content = DEFAULT_NO_ANSWER;
  }

  return {
    content,
    richContent,
    conversationId,
    state,
    summaryContent,
    followUpQuestionContent,
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
