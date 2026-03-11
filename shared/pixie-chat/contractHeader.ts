import { CHAT_CONTRACT_VERSION } from "./contract";

const CONTRACT_MISMATCH_ERROR =
  "The chat service is temporarily unavailable due to a version mismatch. Please refresh the page or try again later.";

type HeaderReader = {
  get(name: string): string | null;
};

export function assertChatContractHeader(headers: HeaderReader): string | null {
  const contractHeader = headers.get("X-Pixie-Chat-Contract");
  if (contractHeader && contractHeader !== CHAT_CONTRACT_VERSION) {
    throw new Error(CONTRACT_MISMATCH_ERROR);
  }
  return contractHeader;
}
