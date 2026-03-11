export const ROLE_USER = "user" as const;
export const ROLE_ASSISTANT = "assistant" as const;

export const RESPONSE_ASK_USER = "ask_user" as const;
export const RESPONSE_ANSWER = "answer" as const;
export const RESPONSE_SUMMARY = "summary" as const;
export const RESPONSE_NO_RESULTS = "no_results" as const;
export const RESPONSE_NOT_RELEVANT = "not_relevant" as const;
export const RESPONSE_ERROR = "error" as const;

export type Role = typeof ROLE_USER | typeof ROLE_ASSISTANT;
export type ResponseType =
  | typeof RESPONSE_ASK_USER
  | typeof RESPONSE_ANSWER
  | typeof RESPONSE_SUMMARY
  | typeof RESPONSE_NO_RESULTS
  | typeof RESPONSE_NOT_RELEVANT
  | typeof RESPONSE_ERROR;

export const SEARCH_RESULTS = "search-results" as const;
