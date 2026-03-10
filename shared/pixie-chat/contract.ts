import type { components } from "../../services/chat-ui/src/api/generated/chatContract";

export const CHAT_CONTRACT_VERSION = "chat-v2.0.0";

export type QuestionerChatContractRequest = components["schemas"]["ChatRequest"];
export type QuestionerChatContractResponse = components["schemas"]["ChatResponse"];
