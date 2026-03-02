import { afterEach, describe, expect, it, vi } from "vitest";

import { sendChatMessage } from "./chat";

describe("sendChatMessage contract version", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts questioner responses with chat-v2.0.0 contract headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "answer",
          text: "ok",
          conversation_id: "session-1",
          state: {},
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Pixie-Chat-Contract": "chat-v2.0.0",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendChatMessage({
      currentAnswer: "Hallo",
      sessionId: "session-1",
      state: {},
    });

    expect(result.contract_version).toBe("chat-v2.0.0");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
