import type { Role } from "../constants";

export type ChatRole = Role;

export type MessageVariant = "summary";

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
