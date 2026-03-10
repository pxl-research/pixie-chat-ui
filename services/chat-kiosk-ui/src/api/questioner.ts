import { assertChatContractHeader } from "@pixie-chat/contractHeader";
import type { PixieChatApiResponse } from "@pixie-chat/responseParser";

export type SendQuestionerMessageInput = {
  baseUrl: string;
  caseId: string;
  currentAnswer: string;
  sessionId?: string | null;
  state: Record<string, unknown>;
};

export type QuestionerChatResponse = PixieChatApiResponse & {
  contract_version?: string | null;
};

export async function sendQuestionerMessage(
  input: SendQuestionerMessageInput,
): Promise<QuestionerChatResponse> {
  const response = await fetch(`${input.baseUrl}/cases/${input.caseId}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      current_answer: input.currentAnswer,
      session_id: input.sessionId,
      state: input.state,
    }),
  });

  if (!response.ok) {
    const detailText = await response.text();
    throw new Error(detailText || `Request failed with status ${response.status}`);
  }

  const contractVersion = assertChatContractHeader(response.headers);
  const parsed = (await response.json()) as QuestionerChatResponse;

  return contractVersion ? { ...parsed, contract_version: contractVersion } : parsed;
}
