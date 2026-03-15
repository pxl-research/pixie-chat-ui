import type { Role } from "../constants";
import type { AssistantRichContent } from "@pixie-chat/responseParser";

export type {
  SearchResultAttribute,
  SearchResultItem,
  SearchResultsResponse,
  AssistantRichContent as SharedAssistantRichContent,
} from "@pixie-chat/responseParser";

export type ChatRole = Role;

export type MessageVariant = "summary" | "debug";

export type QuickReplyOption = {
  label: string;
  value: string;
};

export type ChatMessage = {
  role: ChatRole;
  content: string;
  rich?: AssistantRichContent | null;
  variant?: MessageVariant;
};

export type { AssistantRichContent };
