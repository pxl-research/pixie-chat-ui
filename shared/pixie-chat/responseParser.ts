import {
  RESPONSE_ANSWER,
  RESPONSE_ASK_USER,
  RESPONSE_ERROR,
  RESPONSE_NO_RESULTS,
  RESPONSE_NOT_RELEVANT,
  RESPONSE_SUMMARY,
  SEARCH_RESULTS,
} from "./constants";

export type MessageVariant = "summary" | "debug";

export type QuickReplyOption = {
  label: string;
  value: string;
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

export type WineRecommendationItem = {
  name: string;
  country: string;
  region: string;
  aromaDescription: string;
  tasteDescription: string;
};

export type AssistantRichContent =
  | {
      type: typeof SEARCH_RESULTS;
      results: SearchResultsResponse;
    }
  | {
      type: "wine_recommendations";
      intro: string;
      items: WineRecommendationItem[];
    };

export type PixieChatApiQuickReply =
  | string
  | {
      label?: string | null;
      value?: string | null;
      text?: string | null;
    };

export type PixieChatApiResponse = {
  type?: string;
  text?: string | null;
  answer?: string | null;
  prompt?: string | null;
  reason?: string | null;
  summary?: string | null;
  summary_text?: string | null;
  summaryText?: string | null;
  follow_up_question?: string | null;
  followUpQuestion?: string | null;
  next_question?: string | null;
  nextQuestion?: string | null;
  question?: string | null;
  quick_replies?: PixieChatApiQuickReply[] | null;
  quickReplies?: PixieChatApiQuickReply[] | null;
  choices?: PixieChatApiQuickReply[] | null;
  options?: PixieChatApiQuickReply[] | null;
  suggested_answers?: PixieChatApiQuickReply[] | null;
  recommendations?: unknown;
  conversation_id?: string | null;
  conversationId?: string | null;
  state?: Record<string, unknown> | null;
};

export type ParsedPixieChatResponse = {
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
  quickReplies: QuickReplyOption[];
};

const DEFAULT_NO_ANSWER = "Geen antwoord beschikbaar.";

function trimToNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeQuickReplyText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
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

function normalizeQuickReplyArray(raw: unknown): QuickReplyOption[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const normalized: QuickReplyOption[] = [];
  const seenValues = new Set<string>();

  for (const item of raw) {
    let label: string | null = null;
    let value: string | null = null;

    if (typeof item === "string") {
      label = normalizeQuickReplyText(item);
      value = label;
    } else if (item && typeof item === "object" && !Array.isArray(item)) {
      const option = item as Record<string, unknown>;
      label = normalizeQuickReplyText(option.label) ?? normalizeQuickReplyText(option.text);
      value = normalizeQuickReplyText(option.value) ?? label;
    }

    if (!label || !value) {
      continue;
    }

    const dedupeKey = value.toLowerCase();
    if (seenValues.has(dedupeKey)) {
      continue;
    }
    seenValues.add(dedupeKey);
    normalized.push({ label, value });

    if (normalized.length >= 6) {
      break;
    }
  }

  return normalized;
}

function extractQuickReplies(
  dataObject: Record<string, unknown> | null,
  state: Record<string, unknown> | null,
): QuickReplyOption[] {
  const keys = [
    "quick_replies",
    "quickReplies",
    "choices",
    "options",
    "suggested_answers",
  ] as const;

  for (const source of [dataObject, state]) {
    if (!source) {
      continue;
    }
    for (const key of keys) {
      const parsed = normalizeQuickReplyArray(source[key]);
      if (parsed.length > 0) {
        return parsed;
      }
    }
  }

  return [];
}

function normalizeRecommendationArray(raw: unknown): WineRecommendationItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const normalized: WineRecommendationItem[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const recommendation = item as Record<string, unknown>;
    const name = trimToNonEmptyString(recommendation.name);
    const country = trimToNonEmptyString(recommendation.country);
    const region = trimToNonEmptyString(recommendation.region);
    const aromaDescription = trimToNonEmptyString(recommendation.aroma_description);
    const tasteDescription = trimToNonEmptyString(recommendation.taste_description);

    if (!name || !country || !region || !aromaDescription || !tasteDescription) {
      continue;
    }

    normalized.push({
      name,
      country,
      region,
      aromaDescription,
      tasteDescription,
    });
  }

  return normalized;
}

export function parsePixieChatResponse(
  data: PixieChatApiResponse,
): ParsedPixieChatResponse {
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
  let summaryContent = extractFirstString(dataObject, ["summary", "summary_text", "summaryText"]);
  if (!summaryContent && responseType === RESPONSE_SUMMARY) {
    summaryContent = extractFirstString(state, ["summary", "summary_text", "summaryText"]);
  }
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
  let quickReplies: QuickReplyOption[] = [];

  switch (responseType) {
    case RESPONSE_ASK_USER:
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

    case "recommendations": {
      content = textContent ?? DEFAULT_NO_ANSWER;
      const recommendations = normalizeRecommendationArray(dataObject?.recommendations);
      if (recommendations.length > 0) {
        richContent = {
          type: "wine_recommendations",
          intro: content,
          items: recommendations,
        };
      }
      isComplete = true;
      shouldContinueConversation = false;
      break;
    }

    default:
      content = textContent ?? null;
      shouldContinueConversation = hasConversationId;
      break;
  }

  if (!content) {
    content = DEFAULT_NO_ANSWER;
  }

  if (!isComplete && responseType !== RESPONSE_SUMMARY && responseType !== RESPONSE_ERROR) {
    quickReplies = extractQuickReplies(dataObject, state);
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
    quickReplies,
  };
}

function tryParseSearchResults(text: string): SearchResultsResponse | null {
  try {
    const parsed = JSON.parse(text) as SearchResultsResponse | null;
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.items) &&
      parsed.items.length > 0
    ) {
      return parsed;
    }
  } catch {
    // Not valid JSON or not search results.
  }

  return null;
}
